import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormField, form, required, schema, type FieldTree } from '@angular/forms/signals';
import type { Signature } from '../../flow-types';
import type { FlowConfig } from '../flow-config';
import { FlowRunner } from '../flow-runner';
import { FlowStep } from '../flow-step';
import { FlowIntro, FlowReceipt } from '../flow-slots';

export interface TestModel { one: { name: string }; two: { city: string }; }

export const TEST_CONFIG: FlowConfig<TestModel> = {
  meta: { slug: 'test', title: 'Test Flow', blurb: 'b', dimension: 'minimal' },
  schemaVersion: 1,
  toSubmission: (m) => m,
};

const TEST_SCHEMA = schema<TestModel>((p) => {
  required(p.one.name, { message: 'Name required' });
  required(p.two.city, { message: 'City required' });
});

@Component({
  selector: 'tommy-test-host',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tommy-flow-runner [config]="config" [form]="form()" [loadError]="loadError()"
                       [resume]="resume()" (retry)="onRetry()">
      <ng-template flowIntro><h2 class="ui-title">Test Flow</h2><p class="ui-muted">intro copy</p></ng-template>

      @if (form(); as form) {
        <ng-template [flowStep]="form.one" flowStepKey="one" flowStepLabel="One" let-field let-showErrors="showErrors">
          <input [formField]="field.name" id="t-name" />
        </ng-template>
        <ng-template [flowStep]="form.two" flowStepKey="two" flowStepLabel="Two" let-field let-showErrors="showErrors">
          <input [formField]="field.city" id="t-city" />
        </ng-template>
      }

      <ng-template flowReceipt let-result><p id="rcpt">All set — {{ result.confirmationId }}</p></ng-template>
    </tommy-flow-runner>
  `,
})
export class TestHost {
  readonly config = TEST_CONFIG;
  readonly model = signal<TestModel>({ one: { name: '' }, two: { city: '' } });
  /** form() returns undefined until `formReady` is true (simulates env loading). */
  readonly formReady = signal(true);
  private readonly builtForm: FieldTree<TestModel> = form(this.model, TEST_SCHEMA);
  readonly form = computed(() => (this.formReady() ? this.builtForm : undefined));
  readonly loadError = signal<string | null>(null);
  readonly resume = signal<Signature | null>(null);
  readonly retried = signal(false);

  /**
   * On a load-failure retry, a real flow component re-attempts loading, which clears
   * its own `loadError`. We mirror that here so the runner's loadError effect does not
   * immediately re-fire against a stale message and bounce straight back to the error page.
   */
  onRetry(): void {
    this.retried.set(true);
    this.loadError.set(null);
  }
}
