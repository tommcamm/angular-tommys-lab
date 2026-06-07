import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { BankModel } from '../model';
import { FieldError } from '../../../ui/field-error';

type Account = BankModel['account'];

@Component({
  selector: 'tommy-bank-account-type-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <fieldset class="ui-field">
        <legend class="ui-label">Account type</legend>
        @for (opt of accountTypes; track opt) {
          <label class="ui-row">
            <input type="radio" [value]="opt" [formField]="f.accountType" />
            <span>{{ opt }}</span>
          </label>
        }
        <tommy-field-error [field]="f.accountType" [show]="showErrors()" />
      </fieldset>
    </div>
  `,
})
export class AccountTypeStep implements StepComponent<Account> {
  readonly field = input.required<FieldTree<Account>>();
  readonly showErrors = input(false);
  protected readonly accountTypes = ['standard', 'student', 'business'] as const;
}
