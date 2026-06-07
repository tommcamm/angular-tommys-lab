import type { FlowEnvelope } from '../../engine/flow-def';
import { tosAcksFrom, type TosAck } from '../../steps/tos-step';

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

export function emptyModel(env: FlowEnvelope): InsuranceModel {
  return {
    policy: { policyNumber: '' },
    incident: { date: '', description: '', injured: false, injuryDetails: '' },
    items: [{ description: '', amount: 0 }],
    tos: tosAcksFrom(env.terms),
  };
}
