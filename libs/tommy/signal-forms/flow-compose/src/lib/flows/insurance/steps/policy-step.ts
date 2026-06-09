import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { InsuranceModel } from '../model';
import { FieldError } from '../../../ui/field-error';

type Policy = InsuranceModel['policy'];

@Component({
  selector: 'tommy-insurance-policy-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="ins-policy">Policy number</label>
        <input id="ins-policy" class="ui-input" [formField]="f.policyNumber" autocomplete="off" />
        <tommy-field-error [field]="f.policyNumber" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class PolicyStep {
  readonly field = input.required<FieldTree<Policy>>();
  readonly showErrors = input(false);
}
