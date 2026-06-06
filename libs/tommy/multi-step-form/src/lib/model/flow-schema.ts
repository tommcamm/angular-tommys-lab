import {
  apply,
  applyEach,
  email,
  maxLength,
  minLength,
  required,
  schema,
  validate,
} from '@angular/forms/signals';
import type { FlowOptions } from './flow-options';
import type { AccountGroup, FlowModel, ProfileGroup } from './flow-model';

/** Step 1 — static personal details. Reusable across forms. */
export const profileSchema = schema<ProfileGroup>((p) => {
  required(p.firstName, { message: 'First name is required' });
  required(p.lastName, { message: 'Last name is required' });
  required(p.email, { message: 'Email is required' });
  email(p.email, { message: 'Enter a valid email address' });
});

/** Step 2 — credentials, parameterized by backend constraints + cross-field match. */
export function accountSchema(options: FlowOptions) {
  return schema<AccountGroup>((p) => {
    required(p.username, { message: 'Username is required' });
    minLength(p.username, options.username.minLength, {
      message: `Username must be at least ${options.username.minLength} characters`,
    });
    maxLength(p.username, options.username.maxLength, {
      message: `Username must be at most ${options.username.maxLength} characters`,
    });
    required(p.password, { message: 'Password is required' });
    minLength(p.password, options.password.minLength, {
      message: `Password must be at least ${options.password.minLength} characters`,
    });
    required(p.confirmPassword, { message: 'Please confirm your password' });
    // Cross-field: read the sibling password value via the field context.
    validate(p.confirmPassword, (ctx) =>
      ctx.value() === ctx.valueOf(p.password)
        ? null
        : { kind: 'passwordMismatch', message: 'Passwords must match' },
    );
  });
}

/** The whole flow: compose the three reusable schemas onto the root model. */
export function flowSchema(options: FlowOptions) {
  return schema<FlowModel>((p) => {
    apply(p.profile, profileSchema);
    apply(p.account, accountSchema(options));
    // Use inline item schema (PathKind.Item) instead of a named schema<TosAck>()
    // which uses PathKind.Root and is not assignable to SchemaOrSchemaFn<TosAck, PathKind.Item>.
    applyEach(p.tos, (item) => {
      validate(item.accepted, (ctx) =>
        ctx.valueOf(item.required) && !ctx.value()
          ? { kind: 'mustAccept', message: 'You must accept this to continue' }
          : null,
      );
    });
  });
}
