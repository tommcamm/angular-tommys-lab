import { signal, type WritableSignal } from '@angular/core';
import {
  email,
  form,
  type FieldTree,
  min,
  minLength,
  required,
  schema,
} from '@angular/forms/signals';

/**
 * The shape of the data backing the sign-up form.
 *
 * Signal forms are built on top of a plain `WritableSignal` of this model, so
 * the model is always the single source of truth and stays fully typed.
 */
export interface SignupModel {
  name: string;
  email: string;
  password: string;
  age: number | null;
}

/** A fresh, empty sign-up model. */
export function emptySignupModel(): SignupModel {
  return { name: '', email: '', password: '', age: null };
}

/**
 * The validation schema for {@link SignupModel}.
 *
 * A `schema` is declarative and reusable: the same rules can drive a component,
 * a unit test, or several forms. Each validator binds to a typed path on the
 * model (e.g. `p.email`) — there are no string field names to keep in sync.
 *
 * NOTE: signal forms are `@experimental` in Angular 21; this API may change.
 */
export const signupSchema = schema<SignupModel>((p) => {
  required(p.name, { message: 'Name is required' });

  required(p.email, { message: 'Email is required' });
  email(p.email, { message: 'Enter a valid email address' });

  required(p.password, { message: 'Password is required' });
  minLength(p.password, 8, {
    message: 'Password must be at least 8 characters',
  });

  required(p.age, { message: 'Age is required' });
  min(p.age, 18, { message: 'You must be at least 18' });
});

/** What {@link createSignupForm} hands back: the model signal and its field tree. */
export interface SignupForm {
  /** The writable source of truth. Mutating this drives the form reactively. */
  readonly model: WritableSignal<SignupModel>;
  /** The signal-forms field tree: `form.email().errors()`, `form().valid()`, … */
  readonly form: FieldTree<SignupModel>;
}

/**
 * Build a sign-up form bound to a fresh model.
 *
 * `form()` reads from the current reactive/injection context, so call this from
 * within one — a component field initializer, or `TestBed.runInInjectionContext`
 * in a unit test.
 */
export function createSignupForm(initial?: Partial<SignupModel>): SignupForm {
  const model = signal<SignupModel>({ ...emptySignupModel(), ...initial });
  return { model, form: form(model, signupSchema) };
}
