import type { FlowEnvelope } from '../../engine/flow-def';
import { tosAcksFrom, type TosAck } from '../../steps/tos-step';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface NewsletterModel {
  contact: { name: string; email: string };
  prefs: { frequency: Frequency; topics: string[] };
  tos: TosAck[];
}

export function emptyModel(env: FlowEnvelope): NewsletterModel {
  return {
    contact: { name: '', email: '' },
    prefs: { frequency: 'weekly', topics: [] },
    tos: tosAcksFrom(env.terms),
  };
}
