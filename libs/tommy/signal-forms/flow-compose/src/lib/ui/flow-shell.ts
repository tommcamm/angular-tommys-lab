import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The outer card frame every flow renders inside. Pure layout: a `.ui-card`
 * with a vertical stack. Content (intro/steps/done) is projected by the runner.
 */
@Component({
  selector: 'tommy-flow-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="ui-card ui-stack"><ng-content /></section>`,
})
export class FlowShell {}
