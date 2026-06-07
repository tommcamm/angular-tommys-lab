import { Injectable } from '@angular/core';

const KEY = 'flow-forge:snapshot';

export interface FlowSnapshot {
  readonly flowSlug: string;
  readonly schemaVersion: number;
  readonly state: string;
  readonly challengeId: string;
  readonly model: unknown;
}

/**
 * Versioned, single-use sessionStorage snapshot for the MitID round-trip. The full
 * page unloads on redirect, so the model must survive here and be restored on boot.
 */
@Injectable({ providedIn: 'root' })
export class FlowStateStore {
  save(snapshot: FlowSnapshot): void {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  }

  /** Returns the snapshot and deletes it (single-use). Null if absent or stale. */
  restore(flowSlug: string, schemaVersion: number): FlowSnapshot | null {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    try {
      const snap = JSON.parse(raw) as FlowSnapshot;
      if (snap.flowSlug !== flowSlug) return null;
      if (snap.schemaVersion !== schemaVersion) return null;
      return snap;
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(KEY);
  }
}
