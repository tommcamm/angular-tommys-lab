import type { FlowFixture } from '../../engine/flow-backend';
import type { FeatureDescriptor, SubmitOutcome } from '../../engine/flow-def';
import { MOCK_IDP_ORIGIN } from '../../engine/mitid';

export type BankFeatures = {
  FULL_NAME: FeatureDescriptor;
  CPR: FeatureDescriptor;
  ACCOUNT_TYPE: FeatureDescriptor;
};

export const bankFixture: FlowFixture<BankFeatures> = {
  features: { FULL_NAME: { mandatory: true }, CPR: { mandatory: true }, ACCOUNT_TYPE: { mandatory: true } },
  terms: {
    tos: {
      title: 'Account Terms',
      body: 'You agree to the account terms and conditions.',
      required: true,
    },
    datashare: {
      title: 'Data sharing',
      body: 'Share anonymised usage data (optional).',
      required: false,
    },
  },
  submit: (payload, signature): SubmitOutcome => {
    if (!signature) {
      const last4 = (payload as { applicant?: { cpr?: string } }).applicant?.cpr?.slice(-4) ?? 'xxxx';
      const challengeId = 'bank-' + last4;
      return {
        status: 'signing_required',
        httpStatus: 202,
        signingUrl: `${MOCK_IDP_ORIGIN}/?challenge=${encodeURIComponent(challengeId)}`,
        challengeId,
      };
    }
    return { status: 'ok', httpStatus: 200, confirmationId: `BANK-${signature.challengeId}` };
  },
};
