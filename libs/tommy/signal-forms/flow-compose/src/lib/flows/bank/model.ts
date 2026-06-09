import type { TosAck } from '../../steps/tos-step';

export type AccountType = '' | 'standard' | 'student' | 'business';

export interface BankModel {
  applicant: { fullName: string; cpr: string; address: string };
  account: { accountType: AccountType };
  tos: TosAck[];
}

/** Env-free skeleton; the env-derived tos[] is seeded by the flow component on env-resolve. */
export function emptyBankModel(): BankModel {
  return {
    applicant: { fullName: '', cpr: '', address: '' },
    account: { accountType: '' },
    tos: [],
  };
}
