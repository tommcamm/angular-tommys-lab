import type { FlowConfig } from '../../engine/flow-config';
import type { InsuranceModel } from './model';

export const INSURANCE_FLOW_CONFIG: FlowConfig<InsuranceModel> = {
  meta: {
    slug: 'insurance',
    title: 'File an insurance claim',
    blurb: 'Add claimed items, reveal injury details, stay under coverage — the complex flow.',
    dimension: 'complex',
  },
  schemaVersion: 1,
  toSubmission: (m) => ({
    policy: m.policy,
    incident: m.incident,
    items: m.items,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
