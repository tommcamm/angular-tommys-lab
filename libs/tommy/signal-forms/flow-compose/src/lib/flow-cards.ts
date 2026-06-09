import { NEWSLETTER_FLOW_CONFIG } from './flows/newsletter/newsletter-config';
import { BANK_FLOW_CONFIG } from './flows/bank/bank-config';
import { INSURANCE_FLOW_CONFIG } from './flows/insurance/insurance-config';

export interface FlowCard {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly dimension: 'minimal' | 'complex' | 'signing';
}

export const FLOW_CARDS: readonly FlowCard[] = [NEWSLETTER_FLOW_CONFIG, BANK_FLOW_CONFIG, INSURANCE_FLOW_CONFIG].map(
  (c) => ({ slug: c.meta.slug, title: c.meta.title, blurb: c.meta.blurb, dimension: c.meta.dimension }),
);

/** slug → schemaVersion, for FlowResume.consume. */
export const FLOW_VERSIONS: Record<string, number> = {
  [NEWSLETTER_FLOW_CONFIG.meta.slug]: NEWSLETTER_FLOW_CONFIG.schemaVersion,
  [BANK_FLOW_CONFIG.meta.slug]: BANK_FLOW_CONFIG.schemaVersion,
  [INSURANCE_FLOW_CONFIG.meta.slug]: INSURANCE_FLOW_CONFIG.schemaVersion,
};
