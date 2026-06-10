import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createFlow } from '../../create-flow';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
import { PolicyStep } from './steps/policy-step';
import { IncidentStep } from './steps/incident-step';
import { ItemsStep } from './steps/items-step';
import { INSURANCE_FLOW_CONFIG } from './insurance-config';
import { emptyInsuranceModel, type InsuranceModel } from './model';
import { insuranceSchema } from './schema';

@Component({
  selector: 'tommy-insurance-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, PolicyStep, IncidentStep, ItemsStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insurance-flow.html',
})
export class InsuranceFlow {
  protected readonly flow = createFlow<InsuranceModel>({
    config: INSURANCE_FLOW_CONFIG,
    schema: insuranceSchema,
    emptyModel: emptyInsuranceModel,
    seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }),
  });
}
