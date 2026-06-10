import type { FlowFixture } from '../../io/flow-backend';
import type { FeatureDescriptor } from '../../flow-types';

export type NewsletterFeatures = { NAME: FeatureDescriptor; EMAIL: FeatureDescriptor };

export const newsletterFixture: FlowFixture<NewsletterFeatures> = {
  features: { NAME: { mandatory: true }, EMAIL: { mandatory: true } },
  terms: {
    privacy: {
      title: 'Privacy Policy',
      body: 'We process your data as described in our policy.',
      required: true,
    },
    marketing: {
      title: 'Product updates',
      body: 'Send me occasional product news (optional).',
      required: false,
    },
  },
  submit: (payload) => ({
    status: 'ok',
    httpStatus: 200,
    confirmationId: `NEWS-${(payload as { contact?: { email?: string } }).contact?.email ?? 'x'}`,
  }),
};
