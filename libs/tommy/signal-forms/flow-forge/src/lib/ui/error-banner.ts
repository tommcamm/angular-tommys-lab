import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Presentational summary of a step's validation errors. Renders nothing when the
 * list is empty; `role="alert"` plus a CDK LiveAnnouncer so assistive tech announces
 * it (it appears on a deliberate Next/Submit press, not on every keystroke).
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
  private readonly announcer = inject(LiveAnnouncer);
  readonly messages = input.required<readonly string[]>();

  constructor() {
    effect(() => {
      const count = this.messages().length;
      if (count) {
        this.announcer.announce(
          `${count} field${count === 1 ? '' : 's'} need attention.`,
          'assertive',
        );
      }
    });
  }
}
