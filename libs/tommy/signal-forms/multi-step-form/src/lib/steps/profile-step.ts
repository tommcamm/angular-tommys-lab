import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { ProfileGroup } from '../model/flow-model';
import { FieldError } from '../ui/field-error';

@Component({
  selector: 'tommy-profile-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="ms-firstName">First name</label>
        <input
          id="ms-firstName"
          class="ui-input"
          [formField]="f.firstName"
          autocomplete="given-name"
        />
        <tommy-field-error [field]="f.firstName" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-lastName">Last name</label>
        <input
          id="ms-lastName"
          class="ui-input"
          [formField]="f.lastName"
          autocomplete="family-name"
        />
        <tommy-field-error [field]="f.lastName" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-email">Email</label>
        <input
          id="ms-email"
          type="email"
          class="ui-input"
          [formField]="f.email"
          autocomplete="email"
        />
        <tommy-field-error [field]="f.email" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class ProfileStep {
  readonly field = input.required<FieldTree<ProfileGroup>>();
  readonly showErrors = input(false);
}
