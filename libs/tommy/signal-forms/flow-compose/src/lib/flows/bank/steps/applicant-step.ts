import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { BankModel } from '../model';
import { FieldError } from '../../../ui/field-error';

type Applicant = BankModel['applicant'];

@Component({
  selector: 'tommy-bank-applicant-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="bank-fullName">Full name</label>
        <input id="bank-fullName" class="ui-input" [formField]="f.fullName" autocomplete="name" />
        <tommy-field-error [field]="f.fullName" [show]="showErrors()" />
      </div>
      <div class="ui-field">
        <label class="ui-label" for="bank-cpr">CPR number</label>
        <input id="bank-cpr" class="ui-input" [formField]="f.cpr" autocomplete="off" />
        <tommy-field-error [field]="f.cpr" [show]="showErrors()" />
      </div>
      <div class="ui-field">
        <label class="ui-label" for="bank-address">Address</label>
        <input id="bank-address" class="ui-input" [formField]="f.address" autocomplete="street-address" />
        <tommy-field-error [field]="f.address" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class ApplicantStep {
  readonly field = input.required<FieldTree<Applicant>>();
  readonly showErrors = input(false);
}
