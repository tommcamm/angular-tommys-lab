import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, Injector, computed, inject, input, signal,
} from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { AnyFlowDef, FlowEnvelope, FlowForm } from './flow-def';
import { FlowBackend } from './flow-backend';
import { createWizard, type StepState, type Wizard } from './wizard';
import { FlowShell } from '../ui/flow-shell';
import { StepIndicator } from '../ui/step-indicator';
import { ErrorBanner } from '../ui/error-banner';

declare const ngDevMode: boolean | undefined;

@Component({
  selector: 'tommy-flow-runner',
  imports: [NgComponentOutlet, FlowShell, StepIndicator, ErrorBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-runner.html',
})
export class FlowRunner {
  private readonly backend = inject(FlowBackend);
  private readonly injector = inject(Injector);

  readonly def = input.required<AnyFlowDef>();

  protected readonly env = signal<FlowEnvelope | null>(null);
  protected readonly flowForm = signal<FlowForm<unknown> | null>(null);
  protected readonly confirmationId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly starting = signal(false);
  protected readonly submitting = signal(false);

  /**
   * ONE stable wizard per mounted runner. Built lazily on first access from the
   * (required, set-once) `def` input, then memoized — so `start()`/`next()` and
   * the template all read the SAME instance. A `computed` would re-run if `def`
   * notified, recreating the wizard and losing its phase/step state.
   */
  private wizardInstance: Wizard | null = null;
  protected wizard(): Wizard {
    return (this.wizardInstance ??= createWizard(
      this.def().steps.map((s) => ({ key: s.key, label: s.label })),
    ));
  }

  protected readonly currentStepDef = computed(() => {
    const w = this.wizard();
    const key = w.currentKey();
    const step = this.def().steps.find((s) => s.key === key);
    if (!step) throw new Error(`No step def for key "${key}"`);
    return step;
  });

  protected readonly stepInputs = computed<Record<string, unknown>>(() => {
    const ff = this.flowForm();
    const env = this.env();
    const step = this.currentStepDef();
    if (!ff || !env) return {};
    const inputs: Record<string, unknown> = {
      field: step.field(ff.form),
      showErrors: this.wizard().attempted(),
    };
    // `data` is an OPTIONAL part of the fixed input set: only bind it for steps
    // that declare a `data` input (otherwise NgComponentOutlet warns NG0303).
    if (step.data) inputs['data'] = step.data(env);
    return inputs;
  });

  protected currentStepState(): StepState | null {
    const ff = this.flowForm();
    if (!ff) return null;
    return adaptState(this.currentStepDef().field(ff.form));
  }

  async start(): Promise<void> {
    if (this.flowForm()) {
      // Resume an already-loaded flow (e.g. after Back from step 0 to intro) — keep data, no re-fetch.
      this.wizard().phase.set('form');
      return;
    }
    this.starting.set(true);
    this.loadError.set(null);
    try {
      const env = await this.backend.loadOptions(this.def().meta.slug);
      this.env.set(env);
      this.flowForm.set(this.def().buildForm(env, this.injector));
      this.wizard().stepIndex.set(0);
      this.wizard().phase.set('form');
    } catch (e) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode) console.error('[flow-forge] flow load failed', e);
      this.loadError.set('Could not start this flow. Please retry.');
    } finally {
      this.starting.set(false);
    }
  }

  next(): void {
    this.submitError.set(null);
    const state = this.currentStepState();
    if (state) this.wizard().next(state);
  }

  back(): void {
    this.submitError.set(null);
    this.wizard().back();
  }

  // Submit is implemented in Task 8.
  async onSubmit(): Promise<void> {
    /* implemented in Task 8 */
  }

  reset(): void {
    this.env.set(null);
    this.flowForm.set(null);
    this.confirmationId.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.starting.set(false);
    this.submitting.set(false);
    this.wizard().reset();
  }
}

/** Adapt a signal-forms FieldTree node to the wizard's StepState interface. */
function adaptState(node: FieldTree<unknown>): StepState {
  const s = node();
  return {
    valid: () => s.valid(),
    errorSummary: () => s.errorSummary(),
    reset: () => s.reset(),
  };
}
