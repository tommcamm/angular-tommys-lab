import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, resource, signal } from '@angular/core';
import type { Signature } from '../../engine/flow-types';
import { FlowBackend } from '../../engine/flow-backend';
import { FlowResume } from '../../engine/flow-resume';
import { FlowRunner } from '../../engine/flow-runner';
import { FlowStep } from '../../engine/flow-step';
import { FlowIntro, FlowReceipt } from '../../engine/flow-slots';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { PolicyStep } from './steps/policy-step';
import { IncidentStep } from './steps/incident-step';
import { ItemsStep } from './steps/items-step';
import { INSURANCE_FLOW_CONFIG } from './insurance-config';
import { emptyInsuranceModel, type InsuranceModel } from './model';
import { insuranceForm } from './form';

@Component({
  selector: 'tommy-insurance-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, PolicyStep, IncidentStep, ItemsStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insurance-flow.html',
})
export class InsuranceFlow {
  private readonly injector = inject(Injector);
  private readonly backend = inject(FlowBackend);
  private readonly resume = inject(FlowResume);
  private readonly pending = this.resume.pending('insurance');

  protected readonly config = INSURANCE_FLOW_CONFIG;
  protected readonly env = resource({ loader: () => this.backend.loadOptions('insurance') });
  protected readonly model = signal<InsuranceModel>(
    this.pending
      ? ((INSURANCE_FLOW_CONFIG.restore?.(this.pending.model) ?? this.pending.model) as InsuranceModel)
      : emptyInsuranceModel(),
  );
  protected readonly form = computed(() =>
    this.env.hasValue() ? insuranceForm(this.model, this.env.value()!, this.injector) : undefined,
  );
  // Held back until the form has rendered (see bank-flow for the timing rationale).
  protected readonly signature = signal<Signature | null>(null);
  protected readonly loadErrorMsg = computed(() =>
    this.env.error() ? 'Could not start this flow. Please retry.' : null,
  );

  constructor() {
    // Seed env-derived defaults (the tos[] array) once env resolves — NOT when resuming.
    effect(() => {
      if (this.pending || !this.env.hasValue()) return;
      this.model.update((m) => ({ ...m, tos: tosAcksFrom(this.env.value()!.terms) }));
    });

    const sig = this.pending?.signature;
    if (sig) {
      let scheduled = false;
      effect(() => {
        if (scheduled || !this.form()) return;
        scheduled = true;
        afterNextRender(() => this.signature.set(sig), { injector: this.injector });
      });
    }
  }
}
