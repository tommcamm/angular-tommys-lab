import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { TermsMap } from '../engine/flow-types';
import { FieldError } from '../ui/field-error';

/** One acceptance row in the form model (bridged from the terms map). */
export interface TosAck {
  id: string;
  required: boolean;
  accepted: boolean;
}

/** Build the model array from a terms map (preserves key/insertion order). */
export function tosAcksFrom(terms: TermsMap): TosAck[] {
  return Object.entries(terms).map(([id, t]) => ({
    id,
    required: t.required,
    accepted: false,
  }));
}

@Component({
  selector: 'tommy-tos-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    @let termsMap = terms();
    <div class="ui-stack">
      @for (ack of f; track $index; let i = $index) {
        <!-- A step's field array and its data map must share keys: the model's
             tos is built from this same terms map via tosAcksFrom, so every id resolves. -->
        @let item = termsMap[f[i]().value().id];
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
  readonly showErrors = input(false);
  readonly terms = input.required<TermsMap>();
}
