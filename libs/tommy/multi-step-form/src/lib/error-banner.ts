import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Presentational summary of a step's validation errors. Renders nothing when the
 * list is empty; `role="alert"` so assistive tech announces it (it appears on a
 * deliberate Next/Submit press, not on every keystroke).
 */
@Component({
  selector: 'tommy-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (messages().length) {
      <div class="ui-banner-warning" role="alert">
        <p class="ui-banner-title">
          <span aria-hidden="true">⚠</span> One or more fields have errors:
        </p>
        <ul class="ui-banner-list">
          @for (message of messages(); track $index) {
            <li>{{ message }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class ErrorBanner {
  readonly messages = input.required<readonly string[]>();
}
