import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { TosItem } from '../flow-options';
import type { TosAck } from '../flow-model';

@Component({
  selector: 'tommy-tos-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @for (ack of f; track $index; let i = $index) {
        @let item = items()[i];
        @let state = ack.accepted();
        <label class="ui-tos-item">
          <input type="checkbox" [formField]="ack.accepted" />
          <span class="ui-field">
            <span>
              <strong>{{ item.title }}</strong>
              @if (item.required) { <span class="ui-required">*</span> }
            </span>
            <span class="ui-muted">{{ item.body }}</span>
            @if ((showErrors() || state.touched()) && state.invalid()) {
              <span class="ui-error">{{ state.errors()[0]?.message }}</span>
            }
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
