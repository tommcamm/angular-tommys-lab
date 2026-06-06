import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

/**
 * Renders a single field's first validation error, but only after `show` becomes
 * true (i.e. after the user pressed Next/Submit). Generic so it accepts any field
 * node type — `FieldTree<T>` is invariant in T (its value is a WritableSignal<T>),
 * so a non-generic `FieldTree<unknown>` input would reject `FieldTree<string>`.
 * Emits a `<span>` so it is valid HTML inside both `<div>` and `<span>` field rows.
 */
@Component({
  selector: 'tommy-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let node = field();
    @let state = node();
    @if (show() && state.invalid()) {
      <span class="ui-error">{{ state.errors()[0]?.message }}</span>
    }
  `,
})
export class FieldError<T> {
  readonly field = input.required<FieldTree<T>>();
  readonly show = input.required<boolean>();
}
