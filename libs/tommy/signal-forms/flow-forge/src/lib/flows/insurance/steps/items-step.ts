import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { ClaimItem } from '../model';
import { FieldError } from '../../../ui/field-error';

@Component({
  selector: 'tommy-insurance-items-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @for (row of f; track $index; let i = $index) {
        <div class="ui-row">
          <input class="ui-input" placeholder="Item" [formField]="row.description" />
          <input class="ui-input" type="number" placeholder="Amount" [formField]="row.amount" />
          <button type="button" class="ui-btn" (click)="remove(i)" [disabled]="f.length <= 1">
            Remove
          </button>
        </div>
        <tommy-field-error [field]="row.description" [show]="showErrors()" />
        <tommy-field-error [field]="row.amount" [show]="showErrors()" />
      }
      <button type="button" class="ui-btn" (click)="add()">+ Add item</button>
      @if (showErrors() && f().invalid()) {
        @for (err of f().errors(); track $index) {
          <span class="ui-error">{{ err.message }}</span>
        }
      }
    </div>
  `,
})
export class ItemsStep implements StepComponent<ClaimItem[]> {
  readonly field = input.required<FieldTree<ClaimItem[]>>();
  readonly showErrors = input(false);

  add(): void {
    this.field()().value.update((arr) => [...arr, { description: '', amount: 0 }]);
  }
  remove(i: number): void {
    this.field()().value.update((arr) => arr.filter((_, idx) => idx !== i));
  }
}
