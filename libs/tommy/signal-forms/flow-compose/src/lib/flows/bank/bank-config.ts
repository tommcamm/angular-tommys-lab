import type { FlowConfig } from '../../runner/flow-config';
import type { BankModel } from './model';

export const BANK_FLOW_CONFIG: FlowConfig<BankModel> = {
  meta: {
    slug: 'bank',
    title: 'Open a bank account',
    blurb: 'Apply, then sign with MitID to finish — the in-context signing flow.',
    dimension: 'signing',
  },
  schemaVersion: 1,
  toSubmission: (m) => ({
    applicant: m.applicant,
    accountType: m.account.accountType,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
