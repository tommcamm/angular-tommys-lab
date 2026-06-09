import type { FlowMeta } from './engine/flow-types';
import { NEWSLETTER_FLOW_CONFIG } from './flows/newsletter/newsletter-config';
import { BANK_FLOW_CONFIG } from './flows/bank/bank-config';
import { INSURANCE_FLOW_CONFIG } from './flows/insurance/insurance-config';

export interface FlowCard {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly dimension: FlowMeta['dimension'];
}

export const FLOW_CARDS: readonly FlowCard[] = [NEWSLETTER_FLOW_CONFIG, BANK_FLOW_CONFIG, INSURANCE_FLOW_CONFIG].map(
  (c) => ({ slug: c.meta.slug, title: c.meta.title, blurb: c.meta.blurb, dimension: c.meta.dimension }),
);

/** slug → schemaVersion, for FlowResume.consume. `undefined` for an unknown slug. */
export const FLOW_VERSIONS: Partial<Record<string, number>> = {
  [NEWSLETTER_FLOW_CONFIG.meta.slug]: NEWSLETTER_FLOW_CONFIG.schemaVersion,
  [BANK_FLOW_CONFIG.meta.slug]: BANK_FLOW_CONFIG.schemaVersion,
  [INSURANCE_FLOW_CONFIG.meta.slug]: INSURANCE_FLOW_CONFIG.schemaVersion,
};
