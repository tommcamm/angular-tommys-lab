import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { AccountGroup } from '../flow-model';

@Component({
  selector: 'tommy-account-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @let username = f.username();
      <div class="ui-field">
        <label class="ui-label" for="ms-username">Username</label>
        <input id="ms-username" class="ui-input" [formField]="f.username" autocomplete="username" />
        @if ((showErrors() || username.touched()) && username.invalid()) {
          <p class="ui-error">{{ username.errors()[0]?.message }}</p>
        }
      </div>

      @let password = f.password();
      <div class="ui-field">
        <label class="ui-label" for="ms-password">Password</label>
        <input id="ms-password" type="password" class="ui-input" [formField]="f.password" autocomplete="new-password" />
        @if ((showErrors() || password.touched()) && password.invalid()) {
          <p class="ui-error">{{ password.errors()[0]?.message }}</p>
        }
      </div>

      @let confirm = f.confirmPassword();
      <div class="ui-field">
        <label class="ui-label" for="ms-confirm">Confirm password</label>
        <input id="ms-confirm" type="password" class="ui-input" [formField]="f.confirmPassword" autocomplete="new-password" />
        @if ((showErrors() || confirm.touched()) && confirm.invalid()) {
          <p class="ui-error">{{ confirm.errors()[0]?.message }}</p>
        }
      </div>
    </div>
  `,
})
export class AccountStep {
  readonly field = input.required<FieldTree<AccountGroup>>();
  readonly showErrors = input(false);
}
