import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { AccountGroup } from '../model/flow-model';
import { FieldError } from '../ui/field-error';

@Component({
  selector: 'tommy-account-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="ms-username">Username</label>
        <input
          id="ms-username"
          class="ui-input"
          [formField]="f.username"
          autocomplete="username"
        />
        <tommy-field-error [field]="f.username" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-password">Password</label>
        <input
          id="ms-password"
          type="password"
          class="ui-input"
          [formField]="f.password"
          autocomplete="new-password"
        />
        <tommy-field-error [field]="f.password" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-confirm">Confirm password</label>
        <input
          id="ms-confirm"
          type="password"
          class="ui-input"
          [formField]="f.confirmPassword"
          autocomplete="new-password"
        />
        <tommy-field-error [field]="f.confirmPassword" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class AccountStep {
  readonly field = input.required<FieldTree<AccountGroup>>();
  readonly showErrors = input(false);
}
