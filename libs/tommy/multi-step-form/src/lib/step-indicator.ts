import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

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
  readonly steps = input.required<readonly string[]>();
  readonly activeIndex = input.required<number>();
  protected readonly labels = computed(() =>
    this.steps().map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
  );
}
