import { Injectable, inject } from '@angular/core';
import { FlowStateStore } from './flow-state-store';
import { parseCallback } from './mitid';
import type { PendingResume } from './resume';

/**
 * Discriminated union so the type proves the invariant: an `approved` cache always
 * carries a `pending`, a `cancelled` one never does — no nullable-pending type-lie.
 */
type Cached =
  | { readonly slug: string; readonly status: 'approved'; readonly pending: PendingResume }
  | { readonly slug: string; readonly status: 'cancelled'; readonly pending: null };

/**
 * Single-read front for the single-use MitID snapshot. The launcher calls `consume`
 * once on boot; the flow component and runner then read the cached result freely (the
 * replay risk lived in sessionStorage — once validated into memory it is plain state).
 */
@Injectable({ providedIn: 'root' })
export class FlowResume {
  private readonly store = inject(FlowStateStore);
  private cached: Cached | null = null;
  private consumed = false;

  /**
   * The sole `parseCallback` + `store.restore` reader. `versionFor` maps a slug to its
   * `schemaVersion` (the launcher supplies it from the flow configs). Returns the slug
   * to auto-select, or null when there is no valid callback to resume.
   *
   * Idempotent: only the first call reads sessionStorage; later calls return the same
   * slug (or null) regardless of the arguments passed.
   */
  consume(
    q: { get(key: string): string | null },
    versionFor: (slug: string) => number | undefined,
  ): string | null {
    if (this.consumed) return this.cached?.slug ?? null;
    this.consumed = true;

    const cb = parseCallback(q);
    if (cb.mitid !== 'callback' || !cb.flow) return null;

    const version = versionFor(cb.flow);
    if (version === undefined) return null;

    const snap = this.store.restore(cb.flow, version); // single-use
    if (!snap || !cb.state || snap.state !== cb.state) return null; // correlation / replay

    if (cb.status === 'approved' && cb.code) {
      this.cached = {
        slug: cb.flow,
        status: 'approved',
        pending: { model: snap.model, signature: { challengeId: snap.challengeId, code: cb.code } },
      };
    } else {
      // Cancelled, or an approved callback missing its one-time code — degrade safely
      // to "cancelled" (review/resubmit) rather than resume with no signature.
      this.cached = { slug: cb.flow, status: 'cancelled', pending: null };
    }
    return cb.flow;
  }

  /** In-memory, multi-read. The pending resume for a slug (approved only). */
  pending(slug: string): PendingResume | null {
    return this.cached?.slug === slug && this.cached.status === 'approved'
      ? this.cached.pending
      : null;
  }

  /** True only after a valid `cancelled` callback for this slug. */
  cancelledNotice(slug: string): boolean {
    return this.cached?.slug === slug && this.cached.status === 'cancelled';
  }
}
