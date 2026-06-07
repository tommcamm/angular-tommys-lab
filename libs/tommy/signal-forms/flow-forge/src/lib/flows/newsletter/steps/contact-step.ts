import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { NewsletterModel } from '../model';
import { FieldError } from '../../../ui/field-error';

type Contact = NewsletterModel['contact'];

@Component({
  selector: 'tommy-newsletter-contact-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="nl-name">Name</label>
        <input id="nl-name" class="ui-input" [formField]="f.name" autocomplete="name" />
        <tommy-field-error [field]="f.name" [show]="showErrors()" />
      </div>
      <div class="ui-field">
        <label class="ui-label" for="nl-email">Email</label>
        <input id="nl-email" class="ui-input" [formField]="f.email" autocomplete="email" />
        <tommy-field-error [field]="f.email" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class ContactStep implements StepComponent<Contact> {
  readonly field = input.required<FieldTree<Contact>>();
  readonly showErrors = input(false);
}
