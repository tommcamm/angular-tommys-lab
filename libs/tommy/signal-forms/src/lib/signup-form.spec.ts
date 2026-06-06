import { TestBed } from '@angular/core/testing';
import { createSignupForm, type SignupForm } from './signup-form';

/**
 * These tests exercise the signal-forms *logic* directly (no DOM), which is the
 * clearest proof that the experimental `@angular/forms/signals` API works on
 * this Angular 21 setup. `form()` needs an injection context, so we build the
 * form inside `TestBed.runInInjectionContext`.
 */
describe('signup-form (signal forms logic)', () => {
  function build(initial?: Parameters<typeof createSignupForm>[0]): SignupForm {
    return TestBed.runInInjectionContext(() => createSignupForm(initial));
  }

  it('is invalid when empty and reports an error per field', () => {
    const { form } = build();

    expect(form().valid()).toBe(false);
    expect(form.name().errors().length).toBeGreaterThan(0);
    expect(form.email().errors()[0]?.message).toBe('Email is required');
  });

  it('reactively clears an error as the model is corrected', () => {
    const { model, form } = build();

    expect(form.email().valid()).toBe(false);

    // Patch just the email field on the source-of-truth model signal.
    model.update((m) => ({ ...m, email: 'not-an-email' }));
    expect(form.email().errors()[0]?.message).toBe('Enter a valid email address');

    model.update((m) => ({ ...m, email: 'tommy@example.com' }));
    expect(form.email().valid()).toBe(true);
  });

  it('enforces the password minimum length', () => {
    const { model, form } = build({ password: 'short' });

    expect(form.password().errors()[0]?.message).toBe(
      'Password must be at least 8 characters',
    );

    model.update((m) => ({ ...m, password: 'long-enough' }));
    expect(form.password().valid()).toBe(true);
  });

  it('enforces the minimum age', () => {
    const { model, form } = build({ age: 16 });

    expect(form.age().errors()[0]?.message).toBe('You must be at least 18');

    model.update((m) => ({ ...m, age: 21 }));
    expect(form.age().valid()).toBe(true);
  });

  it('becomes fully valid once every field is filled correctly', () => {
    const { form } = build({
      name: 'Tommy',
      email: 'tommy@example.com',
      password: 'super-secret',
      age: 30,
    });

    expect(form().valid()).toBe(true);
    expect(form().value()).toEqual({
      name: 'Tommy',
      email: 'tommy@example.com',
      password: 'super-secret',
      age: 30,
    });
  });
});
