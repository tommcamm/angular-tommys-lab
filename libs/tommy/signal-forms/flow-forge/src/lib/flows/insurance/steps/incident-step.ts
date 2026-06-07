import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { InsuranceModel } from '../model';
import { FieldError } from '../../../ui/field-error';

type Incident = InsuranceModel['incident'];

@Component({
  selector: 'tommy-insurance-incident-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="ins-date">Incident date</label>
        <input id="ins-date" class="ui-input" type="date" [formField]="f.date" />
        <tommy-field-error [field]="f.date" [show]="showErrors()" />
      </div>
      <div class="ui-field">
        <label class="ui-label" for="ins-desc">What happened?</label>
        <textarea id="ins-desc" class="ui-input" [formField]="f.description"></textarea>
        <tommy-field-error [field]="f.description" [show]="showErrors()" />
      </div>
      <label class="ui-row">
        <input type="checkbox" [formField]="f.injured" />
        <span>Was anyone injured?</span>
      </label>
      @if (f.injured().value()) {
        <div class="ui-field">
          <label class="ui-label" for="ins-injury">Injury details</label>
          <textarea id="ins-injury" class="ui-input" [formField]="f.injuryDetails"></textarea>
          <tommy-field-error [field]="f.injuryDetails" [show]="showErrors()" />
        </div>
      }
    </div>
  `,
})
export class IncidentStep implements StepComponent<Incident> {
  readonly field = input.required<FieldTree<Incident>>();
  readonly showErrors = input(false);
}
