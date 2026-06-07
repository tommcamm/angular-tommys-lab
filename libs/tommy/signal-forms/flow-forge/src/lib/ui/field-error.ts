import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

/**
 * Renders a single field's first validation error, but only after `show` becomes
 * true (the step has been validated, i.e. Next/Submit was pressed) AND the field
 * has not been edited since (`!dirty()`). The container resets the step's
 * `dirty`/`touched` on each Next press, so a still-invalid field re-reveals its
 * error then, while a field the user has started fixing stays quiet until the
 * next press. Generic so it accepts any field node type — `FieldTree<T>` is
 * invariant in T. Emits a `<span>` so it is valid inside both `<div>` and
 * `<span>` field rows.
 */
@Component({
  selector: 'tommy-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let node = field();
    @let state = node();
    @if (show() && state.invalid() && !state.dirty()) {
      <span class="ui-error">{{ state.errors()[0]?.message }}</span>
    }
  `,
})
export class FieldError<T> {
  readonly field = input.required<FieldTree<T>>();
  readonly show = input.required<boolean>();
}
