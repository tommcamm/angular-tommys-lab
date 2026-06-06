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
    <tommy-profile-step [field]="form.profile" [showErrors]="show()" />
    <tommy-account-step [field]="form.account" [showErrors]="show()" />
    <tommy-tos-step [field]="form.tos" [items]="opts.tos" [showErrors]="show()" />
  `,
})
class Host {
  readonly opts = OPTS;
  readonly show = signal(false);
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

  it('hides field errors until showErrors is true', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.ui-error').length).toBe(0);

    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    const text = el.textContent ?? '';
    expect(el.querySelectorAll('.ui-error').length).toBeGreaterThan(0);
    expect(text).toContain('First name is required');
    expect(text).toContain('Username is required');
    expect(text).toContain('You must accept this to continue');
  });

  it('keeps field errors hidden after a field is touched while showErrors is false', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    // Marking a field touched (what a blur does) must NOT reveal errors while showErrors is false.
    fixture.componentInstance.form.profile.firstName().markAsTouched();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('.ui-error').length).toBe(0);
  });
});
