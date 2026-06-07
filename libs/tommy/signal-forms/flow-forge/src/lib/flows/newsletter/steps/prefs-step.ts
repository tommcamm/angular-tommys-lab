import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { NewsletterModel } from '../model';

type Prefs = NewsletterModel['prefs'];

@Component({
  selector: 'tommy-newsletter-prefs-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <fieldset class="ui-field">
        <legend class="ui-label">Frequency</legend>
        @for (opt of frequencies; track opt) {
          <label class="ui-row">
            <input type="radio" [value]="opt" [formField]="f.frequency" />
            <span>{{ opt }}</span>
          </label>
        }
      </fieldset>
    </div>
  `,
})
export class PrefsStep implements StepComponent<Prefs> {
  readonly field = input.required<FieldTree<Prefs>>();
  readonly showErrors = input(false);
  protected readonly frequencies = ['daily', 'weekly', 'monthly'] as const;
}
