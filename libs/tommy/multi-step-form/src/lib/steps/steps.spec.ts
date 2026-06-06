import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, type FieldTree } from '@angular/forms/signals';
import type { FlowOptions } from '../flow-options';
import { emptyFlowModel, type FlowModel } from '../flow-model';
import { flowSchema } from '../flow-schema';
import { ProfileStep } from './profile-step';
import { AccountStep } from './account-step';
import { TosStep } from './tos-step';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [
    { id: 'terms', title: 'Terms', body: 'agree', required: true },
    { id: 'news', title: 'News', body: 'optional', required: false },
  ],
};

@Component({
  imports: [ProfileStep, AccountStep, TosStep],
  template: `
    <tommy-profile-step [field]="form.profile" />
    <tommy-account-step [field]="form.account" />
    <tommy-tos-step [field]="form.tos" [items]="opts.tos" />
  `,
})
class Host {
  readonly opts = OPTS;
  private readonly model = signal<FlowModel>(emptyFlowModel(OPTS));
  readonly form: FieldTree<FlowModel> = form(this.model, flowSchema(OPTS));
}

describe('step components (smoke)', () => {
  it('render against a real form slice', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('First name');
    expect(text).toContain('Username');
    expect(text).toContain('Terms');
    expect(text).toContain('News');
    expect(el.querySelectorAll('input[type=checkbox]').length).toBe(2);
  });
});
