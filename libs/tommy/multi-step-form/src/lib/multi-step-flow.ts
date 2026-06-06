import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Entry component for the multi-step signal-forms experiment.
 *
 * Task 1 ships only the intro placeholder so routing works end-to-end;
 * Task 6 fleshes this out into the full phase/step state machine.
 */
@Component({
  selector: 'tommy-multi-step-flow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-step-flow.html',
  styleUrl: './multi-step-flow.css',
})
export class MultiStepFlow {}
