import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { TosItem } from '../model/flow-options';
import type { TosAck } from '../model/flow-model';
import { FieldError } from '../ui/field-error';

@Component({
  selector: 'tommy-tos-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @for (ack of f; track $index; let i = $index) {
        @let item = items()[i];
        <label class="ui-tos-item">
          <input type="checkbox" [formField]="ack.accepted" />
          <span class="ui-field">
            <span>
              <strong>{{ item.title }}</strong>
              @if (item.required) {
                <span class="ui-required">*</span>
              }
            </span>
            <span class="ui-muted">{{ item.body }}</span>
            <tommy-field-error [field]="ack.accepted" [show]="showErrors()" />
          </span>
        </label>
      }
    </div>
  `,
})
export class TosStep {
  readonly field = input.required<FieldTree<TosAck[]>>();
  readonly items = input.required<readonly TosItem[]>();
  readonly showErrors = input(false);
}
