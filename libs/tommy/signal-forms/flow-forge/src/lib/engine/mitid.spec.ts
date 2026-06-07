import { buildReturnUrl, isSameOrigin, parseCallback } from './mitid';

describe('mitid', () => {
  const origin = 'https://lab.example';

  it('builds a return URL on the given origin with flow + callback marker', () => {
    const url = buildReturnUrl(origin, 'bank');
    expect(url.startsWith(`${origin}/flow-forge?`)).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get('mitid')).toBe('callback');
    expect(q.get('flow')).toBe('bank');
  });

  it('accepts a same-origin return and rejects a foreign one', () => {
    expect(isSameOrigin('https://lab.example/flow-forge?x=1', origin)).toBe(true);
    expect(isSameOrigin('https://evil.example/flow-forge', origin)).toBe(false);
    expect(isSameOrigin('not a url', origin)).toBe(false);
  });

  it('parses a callback query map', () => {
    const map = new Map([
      ['mitid', 'callback'], ['flow', 'bank'], ['status', 'approved'],
      ['state', 'nonce-123'], ['code', 'otc-9'], ['challenge', 'ch-1'],
    ]);
    const get = (k: string) => map.get(k) ?? null;
    expect(parseCallback({ get })).toEqual({
      mitid: 'callback', flow: 'bank', status: 'approved',
      state: 'nonce-123', code: 'otc-9', challenge: 'ch-1',
    });
  });
});
