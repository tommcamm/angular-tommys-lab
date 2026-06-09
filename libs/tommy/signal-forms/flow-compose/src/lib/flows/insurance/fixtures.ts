import type { FlowFixture } from '../../engine/flow-backend';
import type { FeatureDescriptor } from '../../engine/flow-types';

export type InsuranceFeatures = {
  POLICY_NUMBER: FeatureDescriptor;
  INCIDENT_DATE: FeatureDescriptor;
  AMOUNT: FeatureDescriptor & { maxAmount: number };
};

export const insuranceFixture: FlowFixture<InsuranceFeatures> = {
  features: {
    POLICY_NUMBER: { mandatory: true },
    INCIDENT_DATE: { mandatory: true },
    AMOUNT: { mandatory: true, maxAmount: 50000 },
  },
  terms: {
    tos: {
      title: 'Claim Terms',
      body: 'You confirm the information provided is accurate.',
      required: true,
    },
  },
  submit: (payload) => ({
    status: 'ok',
    httpStatus: 200,
    confirmationId: `CLAIM-${(payload as { policy?: { policyNumber?: string } }).policy?.policyNumber ?? 'NEW'}`,
  }),
};
