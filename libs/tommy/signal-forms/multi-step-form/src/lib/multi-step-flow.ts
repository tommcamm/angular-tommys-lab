import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { submit } from '@angular/forms/signals';
import { FlowService } from './model/flow.service';
import { createFlowForm, type FlowForm } from './model/create-flow-form';
import type { FlowOptions, FlowSubmission } from './model/flow-options';
import type { FlowModel } from './model/flow-model';
import { ProfileStep } from './steps/profile-step';
import { AccountStep } from './steps/account-step';
import { TosStep } from './steps/tos-step';
import { StepIndicator } from './ui/step-indicator';
import { ErrorBanner } from './ui/error-banner';

type Phase = 'intro' | 'form' | 'done';
type StepKey = 'profile' | 'account' | 'tos';
const STEPS: readonly StepKey[] = ['profile', 'account', 'tos'];

function toSubmission(model: FlowModel): FlowSubmission {
  return {
    profile: { ...model.profile },
    account: {
      username: model.account.username,
      password: model.account.password,
    },
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
  protected readonly starting = signal(false);
  protected readonly submitting = signal(false);

  /**
   * Per-step validation gate.
   *  - `null`  → step not validated yet (no Next/Submit pressed here)
   *  - `[]`    → validated and clean (banner cleared for this step)
   *  - `[...]` → validated and invalid; a *frozen* snapshot of banner messages
   * The banner reads this snapshot directly, so editing fields never changes it —
   * only a Next/Submit press re-runs validateStep() and rewrites the entry.
   */
  protected readonly gate = signal<Record<StepKey, readonly string[] | null>>({
    profile: null,
    account: null,
    tos: null,
  });

  protected readonly stepLabels: readonly string[] = [
    'Profile',
    'Account',
    'Terms',
  ];
  protected readonly currentStep = computed(() => STEPS[this.stepIndex()]);
  protected readonly isFirst = computed(() => this.stepIndex() === 0);
  protected readonly isLast = computed(
    () => this.stepIndex() === STEPS.length - 1,
  );

  /** `true` once Next/Submit has been pressed on the current step. Drives the
   *  inline field errors (which then self-hide once a field is edited). */
  protected readonly attempted = computed(
    () => this.gate()[this.currentStep()] !== null,
  );

  /** The frozen banner snapshot for the current step (empty = no banner). */
  protected readonly bannerMessages = computed<readonly string[]>(
    () => this.gate()[this.currentStep()] ?? [],
  );

  /** The active step's FieldState (concrete per step, so we read `valid`/
   *  `errorSummary`/`reset` off a known node). */
  private readonly currentStepState = computed(() => {
    const ff = this.flowForm();
    if (!ff) return null;
    switch (this.currentStep()) {
      case 'profile':
        return ff.form.profile();
      case 'account':
        return ff.form.account();
      case 'tos':
        return ff.form.tos();
    }
  });

  async start(): Promise<void> {
    // Resume a form that was already built (e.g. after Back → intro): keep the
    // user's data, no re-fetch, no spinner.
    if (this.flowForm()) {
      this.phase.set('form');
      return;
    }
    this.starting.set(true);
    this.loadError.set(null);
    try {
      const opts = await this.flow.loadOptions();
      this.options.set(opts);
      this.flowForm.set(createFlowForm(opts, this.injector));
      this.stepIndex.set(0);
      this.phase.set('form');
    } catch {
      this.loadError.set('Could not start the sign-up flow. Please retry.');
    } finally {
      this.starting.set(false);
    }
  }

  next(): void {
    if (!this.validateStep()) return;
    if (!this.isLast()) this.stepIndex.update((i) => i + 1);
  }

  back(): void {
    if (this.isFirst()) {
      // Back from the first step returns to the intro page (form preserved).
      this.phase.set('intro');
      return;
    }
    this.stepIndex.update((i) => i - 1);
  }

  async onSubmit(): Promise<void> {
    const ff = this.flowForm();
    if (!ff) return;
    if (!this.validateStep()) return;
    this.submitError.set(null);
    this.confirmationId.set(null);
    this.submitting.set(true);

    try {
      await submit(ff.form, {
        action: async (field) => {
          const result = await this.flow.submitFlow(
            toSubmission(field().value()),
          );
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
    } finally {
      this.submitting.set(false);
    }

    if (this.confirmationId()) {
      this.phase.set('done');
      return;
    }
    // Server rejected (or threw) — return to the account step with the error
    // visible. Reset the subtree so the (untouched) username re-reveals its
    // inline server error, and freeze the account banner from the live errors.
    const accountState = ff.form.account();
    accountState.reset();
    this.setGate('account', this.snapshotMessages(accountState.errorSummary()));
    this.stepIndex.set(STEPS.indexOf('account'));
  }

  reset(): void {
    this.phase.set('intro');
    this.options.set(null);
    this.flowForm.set(null);
    this.stepIndex.set(0);
    this.confirmationId.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.starting.set(false);
    this.submitting.set(false);
    this.gate.set({ profile: null, account: null, tos: null });
  }

  /**
   * Validate the active step. On success, clears that step's banner and returns
   * `true`. On failure, freezes the banner to the current error snapshot, resets
   * the subtree's touched/dirty (so every still-invalid field re-reveals its
   * inline error and edited-then-fixed fields stop showing), and returns `false`.
   */
  private validateStep(): boolean {
    const state = this.currentStepState();
    if (!state) return false;
    const step = this.currentStep();
    if (state.valid()) {
      this.setGate(step, []);
      return true;
    }
    this.setGate(step, this.snapshotMessages(state.errorSummary()));
    state.reset();
    return false;
  }

  /** One message per invalid field (dedupe by field, first message), mirroring
   *  the inline messages. */
  private snapshotMessages(
    errors: readonly { readonly message?: string; readonly fieldTree: unknown }[],
  ): readonly string[] {
    const seen = new Set<unknown>();
    const messages: string[] = [];
    for (const error of errors) {
      if (seen.has(error.fieldTree)) continue;
      seen.add(error.fieldTree);
      if (error.message) messages.push(error.message);
    }
    return messages;
  }

  private setGate(step: StepKey, value: readonly string[]): void {
    this.gate.update((g) => ({ ...g, [step]: value }));
  }
}
