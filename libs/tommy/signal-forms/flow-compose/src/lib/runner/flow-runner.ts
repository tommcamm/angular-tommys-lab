import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed,
  contentChild, contentChildren, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { submit, type FieldTree } from '@angular/forms/signals';
import type { FlowConfig } from './flow-config';
import type { ServerFieldError, Signature, SubmitOk, SubmitOutcome } from '../flow-types';
import { FlowStep } from './flow-step';
import { FlowIntro, FlowReceipt } from './flow-slots';
import { FlowBackend } from '../io/flow-backend';
import { ExternalRedirect } from '../io/external-redirect';
import { FlowStateStore } from '../io/flow-state-store';
import { buildReturnUrl } from '../io/mitid';
import { createWizard, type StepState, type Wizard } from './wizard';
import { FlowShell } from '../ui/flow-shell';
import { StepIndicator } from '../ui/step-indicator';
import { ErrorBanner } from '../ui/error-banner';

declare const ngDevMode: boolean | undefined;

type Phase = 'intro' | 'form' | 'done' | 'error';
interface ErrorInfo { kind: 'load' | 'submit'; message: string; }

@Component({
  selector: 'tommy-flow-runner',
  imports: [NgTemplateOutlet, FlowShell, StepIndicator, ErrorBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-runner.html',
})
export class FlowRunner {
  private readonly backend = inject(FlowBackend);
  private readonly redirect = inject(ExternalRedirect);
  private readonly store = inject(FlowStateStore);
  private readonly injector = inject(Injector);

  readonly config = input.required<FlowConfig<unknown>>();
  readonly form = input<FieldTree<unknown>>();
  readonly loadError = input<string | null>(null);
  readonly resume = input<Signature | null>(null);
  readonly retry = output<void>();

  protected readonly steps = contentChildren(FlowStep);
  protected readonly introTpl = contentChild.required(FlowIntro);
  protected readonly receiptTpl = contentChild.required(FlowReceipt);

  protected readonly phase = signal<Phase>('intro');
  protected readonly errorInfo = signal<ErrorInfo | null>(null);
  protected readonly result = signal<SubmitOk | null>(null);
  protected readonly submitting = signal(false);

  /**
   * During a MitID resume, show the "completing signing" screen (mirrors v1).
   * A writable signal (not a computed over `resume()`) so it is owned by the resume
   * effect: set true when the re-submit starts, false when it settles. This keeps
   * `reset()` ("Start over") from re-deriving `true` while `resume()` is still truthy.
   */
  protected readonly resuming = signal(false);

  private readonly stepRegion = viewChild<ElementRef<HTMLElement>>('stepRegion');
  /** A resume fires AT MOST ONCE per component lifetime; `reset()` must NOT re-arm it. */
  private resumeConsumed = false;
  private wizard: Wizard | null = null;

  /** Build ONCE on first form-entry, from the settled (post-load) step set. */
  private ensureWizard(): Wizard {
    return (this.wizard ??= createWizard(
      this.steps().map((s) => ({ key: s.key(), label: s.label() })),
    ));
  }
  protected w(): Wizard { return this.ensureWizard(); }

  protected readonly activeStep = computed(() => this.steps()[this.ensureWizard().stepIndex()]);
  protected readonly stepContext = computed(() => ({
    $implicit: this.activeStep().field(),
    showErrors: this.ensureWizard().attempted(),
  }));

  constructor() {
    // A load failure (reported by the flow via [loadError]) is terminal.
    effect(() => {
      const msg = this.loadError();
      if (msg && this.phase() === 'intro') {
        this.errorInfo.set({ kind: 'load', message: msg });
        this.phase.set('error');
      }
    });

    // MitID resume: once form + steps are ready, jump to the last step and re-submit.
    effect(() => {
      const sig = this.resume();
      const f = this.form();
      const ready = this.steps().length > 0;
      if (!sig || !f || !ready || this.resumeConsumed) return;
      this.resumeConsumed = true; // permanent latch: reset() does NOT clear it
      untracked(() => {
        this.phase.set('form');
        const w = this.ensureWizard();
        w.stepIndex.set(this.steps().length - 1);
        this.resuming.set(true);
        void this.onSubmit(sig).finally(() => this.resuming.set(false));
      });
    });

    // Focus the step region on step change (a11y); zoneless-safe via afterNextRender.
    effect(() => {
      if (this.phase() !== 'form' || this.resuming()) return;
      this.wizard?.stepIndex();
      afterNextRender(() => this.stepRegion()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  start(): void {
    this.phase.set('form');
    this.ensureWizard().stepIndex.set(0);
  }

  next(): void {
    const state = this.currentStepState();
    if (state) this.ensureWizard().next(state);
  }

  back(): void {
    const w = this.ensureWizard();
    if (w.isFirst()) this.phase.set('intro');
    else w.back();
  }

  async onSubmit(signature?: Signature): Promise<void> {
    const form = this.form();
    if (!form) return;
    const w = this.ensureWizard();
    const state = this.currentStepState();
    if (!state || !w.validateCurrent(state)) return;

    this.result.set(null);
    this.submitting.set(true);

    const settled: { outcome: SubmitOutcome | null } = { outcome: null };
    try {
      await submit(form, {
        action: async (field) => {
          const payload = this.config().toSubmission(field().value());
          const outcome = await this.backend.submit(this.config().meta.slug, payload, signature);
          settled.outcome = outcome;
          if (outcome.status === 'ok') {
            this.result.set(outcome);
            return null;
          }
          if (outcome.status === 'signing_required') {
            this.beginSigning(outcome.challengeId, outcome.signingUrl, form);
            return null; // page is about to unload
          }
          return outcome.errors.map((e) => this.toServerError(e, form));
        },
      });
    } catch (e) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode) console.error('[flow-compose] submit failed', e);
      this.errorInfo.set({ kind: 'submit', message: 'An unexpected error occurred. Please try again.' });
      this.phase.set('error');
      return;
    } finally {
      this.submitting.set(false);
    }

    const outcome = settled.outcome;
    if (outcome?.status === 'ok') { this.phase.set('done'); return; }
    if (outcome?.status === 'rejected') this.placeRejection(outcome.errors, form);
  }

  tryAgain(): void {
    const info = this.errorInfo();
    this.errorInfo.set(null);
    if (info?.kind === 'load') {
      this.phase.set('intro');
      this.retry.emit();
    } else {
      this.phase.set('form'); // submit failure → back to the (last) step to retry
    }
  }

  reset(): void {
    this.phase.set('intro');
    this.result.set(null);
    this.errorInfo.set(null);
    this.submitting.set(false);
    this.wizard?.reset();
  }

  private currentStepState(): StepState | null {
    const step = this.activeStep();
    return step ? adaptState(step.field()) : null;
  }

  private toServerError(e: ServerFieldError, form: FieldTree<unknown>) {
    const mapped = this.config().mapServerError?.(e, form);
    return { kind: 'server' as const, message: e.message, fieldTree: mapped?.fieldTree ?? form };
  }

  private placeRejection(errors: readonly ServerFieldError[], form: FieldTree<unknown>): void {
    const config = this.config();
    const first = errors[0];
    const mapped = first ? config.mapServerError?.(first, form) : undefined;
    const stepKey = mapped?.stepKey ?? this.steps()[0].key();
    const node = (mapped?.fieldTree ?? form) as FieldTree<unknown>;
    node().reset();
    this.ensureWizard().freezeBanner(stepKey, [...new Set(errors.map((e) => e.message))]);
  }

  private beginSigning(challengeId: string, signingUrl: string, form: FieldTree<unknown>): void {
    const config = this.config();
    const state = crypto.randomUUID();
    const value = form().value();
    const model = config.snapshot ? config.snapshot(value) : JSON.parse(JSON.stringify(value));
    this.store.save({ flowSlug: config.meta.slug, schemaVersion: config.schemaVersion, state, challengeId, model });
    const returnUrl = buildReturnUrl(this.redirect.origin, config.meta.slug);
    const u = new URL(signingUrl);
    u.searchParams.set('state', state);
    u.searchParams.set('return', returnUrl);
    this.redirect.to(u.toString());
  }
}

/** Adapt a signal-forms FieldTree node to the wizard's StepState interface. */
function adaptState(node: FieldTree<unknown>): StepState {
  const s = node();
  return { valid: () => s.valid(), errorSummary: () => s.errorSummary(), reset: () => s.reset() };
}
