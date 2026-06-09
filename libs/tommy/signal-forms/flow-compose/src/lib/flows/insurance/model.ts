import type { TosAck } from '../../steps/tos-step';

export interface ClaimItem {
  description: string;
  amount: number;
}

export interface InsuranceModel {
  policy: { policyNumber: string };
  incident: { date: string; description: string; injured: boolean; injuryDetails: string };
  items: ClaimItem[];
  tos: TosAck[];
}

/** Env-free skeleton; the env-derived tos[] is seeded by the flow component on env-resolve. */
export function emptyInsuranceModel(): InsuranceModel {
  return {
    policy: { policyNumber: '' },
    incident: { date: '', description: '', injured: false, injuryDetails: '' },
    items: [{ description: '', amount: 0 }],
    tos: [],
  };
}
