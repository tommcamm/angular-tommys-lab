import { bankFixture } from './fixtures';

describe('bank fixture submit', () => {
  it('returns 202 signing_required pointing at the mock idp when unsigned', () => {
    const out = bankFixture.submit({});
    expect(out.status).toBe('signing_required');
    if (out.status === 'signing_required') {
      expect(out.httpStatus).toBe(202);
      expect(out.signingUrl).toContain('localhost:4300');
      expect(out.signingUrl).toContain(out.challengeId);
    }
  });
  it('returns 200 ok once a signature is present', () => {
    const out = bankFixture.submit({}, { challengeId: 'c', code: 'otc' });
    expect(out.status).toBe('ok');
    if (out.status === 'ok') expect(out.confirmationId).toMatch(/^BANK-/);
  });
});
