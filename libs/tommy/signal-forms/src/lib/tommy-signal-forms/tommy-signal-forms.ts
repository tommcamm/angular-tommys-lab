import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { FormField } from '@angular/forms/signals';
import { createSignupForm, type SignupModel } from '../signup-form';

/**
 * A small sign-up form built with Angular's experimental signal forms.
 *
 * The `[formField]` directive (from `@angular/forms/signals`) binds a native
 * input to a node of the field tree — two-way value, plus touched/dirty/valid
 * state — without `FormsModule` or `ReactiveFormsModule`.
 */
@Component({
  selector: 'tommy-signup-form',
  imports: [FormField],
  templateUrl: './tommy-signal-forms.html',
  styleUrl: './tommy-signal-forms.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TommySignalForms {
  // `createSignupForm()` calls `form()`, which needs an injection context —
  // a field initializer runs inside the constructor, so this is valid here.
  private readonly signup = createSignupForm();

  protected readonly model = this.signup.model;
  protected readonly form = this.signup.form;

  /** Becomes true after the first submit attempt, to reveal any errors. */
  protected readonly submitted = signal(false);
  /** The value captured on a successful submit. */
  protected readonly saved = signal<SignupModel | null>(null);

  protected onSubmit(): void {
    this.submitted.set(true);
    if (this.form().valid()) {
      this.saved.set(this.form().value());
    }
  }

  protected reset(): void {
    this.submitted.set(false);
    this.saved.set(null);
    this.model.set({ name: '', email: '', password: '', age: null });
  }
}
