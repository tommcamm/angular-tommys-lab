import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'tommy-step-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="ui-steps">
      @for (label of labels(); track $index; let i = $index) {
        <li
          class="ui-step"
          [class.ui-step-active]="i === activeIndex()"
          [class.ui-step-done]="i < activeIndex()"
        >
          <span>{{ i + 1 }}.</span><span>{{ label }}</span>
        </li>
      }
    </ol>
  `,
})
export class StepIndicator {
  /** Human-readable step labels, in order. */
  readonly labels = input.required<readonly string[]>();
  readonly activeIndex = input.required<number>();
}
