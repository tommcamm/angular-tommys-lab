import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  input,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { FormField, form, required, schema, type FieldTree } from '@angular/forms/signals';
import { defineStep, type FlowDef, type StepComponent } from '../flow-def';

interface TestModel {
  one: { name: string };
  two: { city: string };
}

@Component({
  selector: 'tommy-test-step-one',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input [formField]="field().name" id="t-name" />`,
})
export class TestStepOne implements StepComponent<TestModel['one']> {
  readonly field = input.required<FieldTree<TestModel['one']>>();
  readonly showErrors = input(false);
}

@Component({
  selector: 'tommy-test-step-two',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input [formField]="field().city" id="t-city" />`,
})
export class TestStepTwo implements StepComponent<TestModel['two']> {
  readonly field = input.required<FieldTree<TestModel['two']>>();
  readonly showErrors = input(false);
}

export const testFlow: FlowDef<TestModel> = {
  meta: { slug: 'test', title: 'Test Flow', blurb: 'b', intro: 'intro copy', dimension: 'minimal' },
  schemaVersion: 1,
  buildForm: (_env, injector: Injector) => {
    const model = signal<TestModel>({ one: { name: '' }, two: { city: '' } });
    const tree = runInInjectionContext(injector, () =>
      form(
        model,
        schema<TestModel>((p) => {
          required(p.one.name, { message: 'Name required' });
          required(p.two.city, { message: 'City required' });
        }),
      ),
    );
    return { model, form: tree };
  },
  steps: [
    defineStep<TestModel, TestModel['one']>({ key: 'one', label: 'One', component: TestStepOne, field: (f) => f.one }),
    defineStep<TestModel, TestModel['two']>({ key: 'two', label: 'Two', component: TestStepTwo, field: (f) => f.two }),
  ],
  toSubmission: (m) => m,
};
