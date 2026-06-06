import { ChangeDetectionStrategy, Component, Injector, computed, inject, signal } from '@angular/core';
import { submit } from '@angular/forms/signals';
import { FlowService } from './flow.service';
import { createFlowForm, type FlowForm } from './create-flow-form';
import type { FlowOptions, FlowSubmission } from './flow-options';
import type { FlowModel } from './flow-model';
import { ProfileStep } from './steps/profile-step';
import { AccountStep } from './steps/account-step';
import { TosStep } from './steps/tos-step';
import { StepIndicator } from './step-indicator';
import { ErrorBanner } from './error-banner';

type Phase = 'intro' | 'loading' | 'form' | 'submitting' | 'done' | 'error';
type StepKey = 'profile' | 'account' | 'tos';
const STEPS: readonly StepKey[] = ['profile', 'account', 'tos'];

function toSubmission(model: FlowModel): FlowSubmission {
  return {
    profile: { ...model.profile },
    account: { username: model.account.username, password: model.account.password },
    acceptedTosIds: model.tos.filter((t) => t.accepted).map((t) => t.id),
  };
}

@Component({
  selector: 'tommy-multi-step-flow',
  imports: [ProfileStep, AccountStep, TosStep, StepIndicator, ErrorBanner],
  providers: [FlowService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-step-flow.html',
  styleUrl: './multi-step-flow.css',
})
export class MultiStepFlow {
  private readonly flow = inject(FlowService);
  private readonly injector = inject(Injector);

  protected readonly phase = signal<Phase>('intro');
  protected readonly options = signal<FlowOptions | null>(null);
  protected readonly flowForm = signal<FlowForm | null>(null);
  protected readonly stepIndex = signal(0);
  protected readonly confirmationId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly showErrors = signal(false);

  /** Display labels for the step indicator (parallel to STEPS). */
  protected readonly stepLabels: readonly string[] = ['Profile', 'Account', 'Terms'];
  protected readonly currentStep = computed(() => STEPS[this.stepIndex()]);
  protected readonly isFirst = computed(() => this.stepIndex() === 0);
  protected readonly isLast = computed(() => this.stepIndex() === STEPS.length - 1);

  /** The active step's field state. Returns the concrete FieldState per step so
   *  we only ever read the common `valid` / `errorSummary` signals on the union. */
  private readonly currentStepState = computed(() => {
    const ff = this.flowForm();
    if (!ff) return null;
    switch (this.currentStep()) {
      case 'profile': return ff.form.profile();
      case 'account': return ff.form.account();
      case 'tos': return ff.form.tos();
    }
  });

  /** Validity of just the active step's slice — gates "Next"/"Submit". */
  protected readonly currentStepValid = computed((): boolean => {
    const state = this.currentStepState();
    return state ? state.valid() : false;
  });

  /** One message per invalid field on the active step — only after Next pressed.
   *  `errorSummary()` aggregates the node's errors + all descendants'. Dedupe by
   *  field (first message) so the list mirrors the inline messages exactly. */
  protected readonly stepErrorMessages = computed<readonly string[]>(() => {
    if (!this.showErrors()) return [];
    const state = this.currentStepState();
    if (!state) return [];
    const seen = new Set<unknown>();
    const messages: string[] = [];
    for (const error of state.errorSummary()) {
      if (seen.has(error.fieldTree)) continue;
      seen.add(error.fieldTree);
      if (error.message) messages.push(error.message);
    }
    return messages;
  });

  async start(): Promise<void> {
    this.phase.set('loading');
    this.loadError.set(null);
    try {
      const opts = await this.flow.loadOptions();
      this.options.set(opts);
      this.flowForm.set(createFlowForm(opts, this.injector));
      this.stepIndex.set(0);
      this.showErrors.set(false);
      this.phase.set('form');
    } catch {
      this.loadError.set('Could not start the sign-up flow. Please retry.');
      this.phase.set('error');
    }
  }

  next(): void {
    if (!this.currentStepValid()) { this.showErrors.set(true); return; }
    this.showErrors.set(false);
    if (!this.isLast()) this.stepIndex.update((i) => i + 1);
  }

  back(): void {
    this.showErrors.set(false);
    if (!this.isFirst()) this.stepIndex.update((i) => i - 1);
  }

  async onSubmit(): Promise<void> {
    const ff = this.flowForm();
    if (!ff) return;
    if (!this.currentStepValid()) { this.showErrors.set(true); return; }
    this.submitError.set(null);
    this.confirmationId.set(null);
    this.phase.set('submitting');

    try {
      await submit(ff.form, {
        action: async (field) => {
          const result = await this.flow.submitFlow(toSubmission(field().value()));
          if (result.ok) {
            this.confirmationId.set(result.confirmationId);
            return null;
          }
          return result.fieldErrors.map((e) => ({
            kind: 'server',
            message: e.message,
            fieldTree: field.account.username,
          }));
        },
      });
    } catch {
      this.submitError.set('An unexpected error occurred. Please try again.');
    }

    if (this.confirmationId()) {
      this.phase.set('done');
    } else {
      // Server rejected (or threw) — return to the account step with the error visible.
      this.stepIndex.set(STEPS.indexOf('account'));
      this.showErrors.set(true);
      this.phase.set('form');
    }
  }

  reset(): void {
    this.phase.set('intro');
    this.options.set(null);
    this.flowForm.set(null);
    this.stepIndex.set(0);
    this.confirmationId.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.showErrors.set(false);
  }
}
