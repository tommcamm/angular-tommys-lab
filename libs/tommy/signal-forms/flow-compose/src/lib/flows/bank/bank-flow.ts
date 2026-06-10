import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createFlow } from '../../create-flow';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
import { ApplicantStep } from './steps/applicant-step';
import { AccountTypeStep } from './steps/account-type-step';
import { BANK_FLOW_CONFIG } from './bank-config';
import { emptyBankModel, type BankModel } from './model';
import { bankSchema } from './schema';

@Component({
  selector: 'tommy-bank-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, ApplicantStep, AccountTypeStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bank-flow.html',
})
export class BankFlow {
  protected readonly flow = createFlow<BankModel>({
    config: BANK_FLOW_CONFIG,
    schema: bankSchema,
    emptyModel: emptyBankModel,
    seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }),
  });
}
