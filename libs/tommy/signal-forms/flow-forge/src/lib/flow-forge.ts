import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { AnyFlowDef } from './engine/flow-def';
import { FlowRunner } from './engine/flow-runner';
import { FLOW_FIXTURES, FlowBackend } from './engine/flow-backend';
import { FlowStateStore } from './engine/flow-state-store';
import { parseCallback } from './engine/mitid';
import { FIXTURES, FLOWS } from './flow-registry';

@Component({
  selector: 'tommy-flow-forge',
  imports: [FlowRunner],
  // FlowBackend is co-provided here (not just root) so it resolves in this
  // component's injector tree, where FLOW_FIXTURES is visible. (FlowBackend is
  // @Injectable({ providedIn: 'root' }); a root instance would never see the
  // component-level FLOW_FIXTURES.)
  providers: [{ provide: FLOW_FIXTURES, useValue: FIXTURES }, FlowBackend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-forge.html',
})
export class FlowForge {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(FlowStateStore);

  protected readonly flows = FLOWS;
  protected readonly selected = signal<AnyFlowDef | null>(null);
  protected readonly returnNotice = signal<string | null>(null);

  constructor() {
    this.handleCallback();
  }

  /**
   * MitID callback handling on boot. The full approved → rehydrate → re-submit
   * round-trip is Plan 2 (the bank flow). Here we validate the correlation `state`
   * against the single-use snapshot and, on a match, open the flow (+ a notice).
   */
  private handleCallback(): void {
    const cb = parseCallback(this.route.snapshot.queryParamMap);
    if (cb.mitid !== 'callback' || !cb.flow) return;
    const def = FLOWS.find((f) => f.meta.slug === cb.flow);
    if (!def) return;
    const snap = this.store.restore(def.meta.slug, def.schemaVersion); // single-use
    if (!snap || !cb.state || snap.state !== cb.state) return; // correlation/replay check
    this.selected.set(def);
    this.returnNotice.set(
      cb.status === 'cancelled'
        ? 'Signing cancelled — you can review and resubmit.'
        : 'Returned from MitID signing.',
    );
  }

  select(def: AnyFlowDef): void {
    this.returnNotice.set(null);
    this.selected.set(def);
  }

  clear(): void {
    this.selected.set(null);
  }

  badgeClass(dimension: string): string {
    return dimension === 'signing'
      ? 'ui-badge-orange'
      : dimension === 'complex'
        ? 'ui-badge-green'
        : 'ui-badge-blue';
  }
}
