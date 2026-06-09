import type { FlowConfig } from '../../engine/flow-config';
import type { NewsletterModel } from './model';

export const NEWSLETTER_FLOW_CONFIG: FlowConfig<NewsletterModel> = {
  meta: {
    slug: 'newsletter',
    title: 'Subscribe to the newsletter',
    blurb: 'Two short steps and a consent — the minimal flow.',
    dimension: 'minimal',
  },
  schemaVersion: 1,
  toSubmission: (m) => ({
    contact: m.contact,
    prefs: m.prefs,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
