import { TestBed } from '@angular/core/testing';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';
import type { SubmitOutcome } from './flow-def';

// `AMOUNT` carries an extra `minAmount`: structurally assignable to
// `FeatureDescriptor` ({ mandatory: boolean }). Built via a local so strict
// tsc's excess-property check on the inline literal doesn't reject it.
const signFeatures = { AMOUNT: { mandatory: true, minAmount: 1 } };

const signFixture: FlowFixture = {
  features: signFeatures,
  terms: { privacy: { title: 'P', body: 'b', required: true } },
  submit: (_payload, signature): SubmitOutcome =>
    signature
      ? { status: 'ok', httpStatus: 200, confirmationId: 'OK-1' }
      : {
          status: 'signing_required',
          httpStatus: 202,
          signingUrl: 'https://idp/sign?challenge=ch-1',
          challengeId: 'ch-1',
        },
};

describe('FlowBackend', () => {
  let backend: FlowBackend;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        FlowBackend,
        { provide: FLOW_FIXTURES, useValue: new Map([['sign', signFixture]]) },
      ],
    });
    backend = TestBed.inject(FlowBackend);
  });

  it('loads options for a known slug', async () => {
    const env = await backend.loadOptions('sign');
    expect(env.features['AMOUNT'].mandatory).toBe(true);
    expect(env.terms['privacy'].required).toBe(true);
  });

  it('returns 202 without a signature and 200 with one', async () => {
    const a = await backend.submit('sign', {});
    expect(a.status).toBe('signing_required');
    const b = await backend.submit('sign', {}, { challengeId: 'ch-1', code: 'otc' });
    expect(b.status).toBe('ok');
  });

  it('rejects an unknown slug', async () => {
    await expect(backend.loadOptions('nope')).rejects.toBeTruthy();
  });
});
