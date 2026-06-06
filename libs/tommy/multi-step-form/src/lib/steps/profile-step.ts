import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { ProfileGroup } from '../flow-model';

@Component({
  selector: 'tommy-profile-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @let firstName = f.firstName();
      <div class="ui-field">
        <label class="ui-label" for="ms-firstName">First name</label>
        <input id="ms-firstName" class="ui-input" [formField]="f.firstName" autocomplete="given-name" />
        @if ((showErrors() || firstName.touched()) && firstName.invalid()) {
          <p class="ui-error">{{ firstName.errors()[0]?.message }}</p>
        }
      </div>

      @let lastName = f.lastName();
      <div class="ui-field">
        <label class="ui-label" for="ms-lastName">Last name</label>
        <input id="ms-lastName" class="ui-input" [formField]="f.lastName" autocomplete="family-name" />
        @if ((showErrors() || lastName.touched()) && lastName.invalid()) {
          <p class="ui-error">{{ lastName.errors()[0]?.message }}</p>
        }
      </div>

      @let email = f.email();
      <div class="ui-field">
        <label class="ui-label" for="ms-email">Email</label>
        <input id="ms-email" type="email" class="ui-input" [formField]="f.email" autocomplete="email" />
        @if ((showErrors() || email.touched()) && email.invalid()) {
          <p class="ui-error">{{ email.errors()[0]?.message }}</p>
        }
      </div>
    </div>
  `,
})
export class ProfileStep {
  readonly field = input.required<FieldTree<ProfileGroup>>();
  readonly showErrors = input(false);
}
