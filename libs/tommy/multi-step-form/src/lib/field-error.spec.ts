import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required, schema, type FieldTree } from '@angular/forms/signals';
import { FieldError } from './field-error';

interface NameModel {
  name: string;
}

const nameSchema = schema<NameModel>((p) => {
  required(p.name, { message: 'Name is required' });
});

@Component({
  imports: [FieldError],
  template: `<tommy-field-error [field]="form.name" [show]="show()" />`,
})
class Host {
  readonly show = signal(false);
  private readonly model = signal<NameModel>({ name: '' });
  readonly form: FieldTree<NameModel> = form(this.model, nameSchema);
}

describe('FieldError', () => {
  it('shows nothing while show is false, even when invalid', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ui-error')).toBeNull();
  });

  it('shows the first error message once show is true and the field is invalid', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const error = el.querySelector('span.ui-error');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('Name is required');
  });

  it('hides the error again once the field becomes valid', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    fixture.componentInstance.form.name().value.set('Tommy');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ui-error')).toBeNull();
  });
});
