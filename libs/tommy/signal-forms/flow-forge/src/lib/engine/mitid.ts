export interface Callback {
  readonly mitid: string | null;
  readonly flow: string | null;
  readonly status: string | null;
  readonly state: string | null;
  readonly code: string | null;
  readonly challenge: string | null;
}

/** Build the host callback URL the IdP must return to (this origin only). */
export function buildReturnUrl(origin: string, flowSlug: string): string {
  const u = new URL('/flow-forge', origin);
  u.searchParams.set('mitid', 'callback');
  u.searchParams.set('flow', flowSlug);
  return u.toString();
}

/** Reject a return URL whose origin is not ours (no open redirect). */
export function isSameOrigin(returnUrl: string, origin: string): boolean {
  try {
    return new URL(returnUrl).origin === origin;
  } catch {
    return false;
  }
}

/** Read callback fields off any query-map-like object (ActivatedRoute or a Map). */
export function parseCallback(q: { get(key: string): string | null }): Callback {
  return {
    mitid: q.get('mitid'),
    flow: q.get('flow'),
    status: q.get('status'),
    state: q.get('state'),
    code: q.get('code'),
    challenge: q.get('challenge'),
  };
}

/**
 * Origin of the mock MitID provider app (`apps/tommy/mock-idp`, dev port 4300).
 * The bank fixture points its 202 `signingUrl` here. In production this needs a
 * deployed provider origin; absent one, the bank flow's redirect cannot complete
 * (dev-only / degrades — see README).
 */
export const MOCK_IDP_ORIGIN = 'http://localhost:4300';
