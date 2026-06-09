import type { TosAck } from '../../steps/tos-step';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface NewsletterModel {
  contact: { name: string; email: string };
  prefs: { frequency: Frequency };
  tos: TosAck[];
}

/** Env-free skeleton; the env-derived tos[] is seeded by the flow component on env-resolve. */
export function emptyNewsletterModel(): NewsletterModel {
  return {
    contact: { name: '', email: '' },
    prefs: { frequency: 'weekly' },
    tos: [],
  };
}
