import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

export interface FlowStepContext<S> {
  $implicit: FieldTree<S>;
  showErrors: boolean;
}

/**
 * Declares one step of a flow. The field slice IS the directive's main input, so the
 * runner can gate that subtree; the context guard reflects its type into the template
 * so the author's `let-field` is strongly typed.
 */
@Directive({ selector: 'ng-template[flowStep]' })
export class FlowStep<S = unknown> {
  readonly field = input.required<FieldTree<S>>({ alias: 'flowStep' });
  readonly key = input.required<string>({ alias: 'flowStepKey' });
  readonly label = input.required<string>({ alias: 'flowStepLabel' });
  readonly template = inject<TemplateRef<FlowStepContext<S>>>(TemplateRef);

  static ngTemplateContextGuard<S>(
    _dir: FlowStep<S>,
    _ctx: unknown,
  ): _ctx is FlowStepContext<S> {
    return true;
  }
}
