import { Injector, runInInjectionContext, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { defineStep, type FlowDef, type FlowEnvelope } from '../../engine/flow-def';
import { TosStep, type TosAck } from '../../steps/tos-step';
import { emptyModel, type BankModel } from './model';
import { bankSchema } from './schema';
import { ApplicantStep } from './steps/applicant-step';
import { AccountTypeStep } from './steps/account-type-step';

export const bankFlow: FlowDef<BankModel> = {
  meta: {
    slug: 'bank',
    title: 'Open a bank account',
    blurb: 'Apply, then sign with MitID to finish — the in-context signing flow.',
    intro: 'Open a new account. You will confirm with MitID before we create it.',
    dimension: 'signing',
  },
  schemaVersion: 1,
  buildForm: (env: FlowEnvelope, injector: Injector) => {
    const model = signal<BankModel>(emptyModel(env));
    const tree = runInInjectionContext(injector, () => form(model, bankSchema(env)));
    return { model, form: tree };
  },
  steps: [
    defineStep<BankModel, BankModel['applicant']>({
      key: 'applicant',
      label: 'Applicant',
      component: ApplicantStep,
      field: (f) => f.applicant,
    }),
    defineStep<BankModel, BankModel['account']>({
      key: 'account',
      label: 'Account',
      component: AccountTypeStep,
      field: (f) => f.account,
    }),
    defineStep<BankModel, TosAck[], FlowEnvelope['terms']>({
      key: 'tos',
      label: 'Terms',
      component: TosStep,
      field: (f) => f.tos,
      data: (env) => env.terms,
    }),
  ],
  toSubmission: (m) => ({
    applicant: m.applicant,
    accountType: m.account.accountType,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
