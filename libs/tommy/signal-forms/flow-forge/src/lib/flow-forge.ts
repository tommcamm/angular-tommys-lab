import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tommy-flow-forge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Flow Forge — coming online…</p>`,
})
export class FlowForge {}
