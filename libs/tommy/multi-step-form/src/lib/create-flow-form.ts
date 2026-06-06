import { runInInjectionContext, signal, type Injector, type WritableSignal } from '@angular/core';
import { form, type FieldTree } from '@angular/forms/signals';
import type { FlowOptions } from './flow-options';
import { emptyFlowModel, type FlowModel } from './flow-model';
import { flowSchema } from './flow-schema';

export interface FlowForm {
  readonly model: WritableSignal<FlowModel>;
  readonly form: FieldTree<FlowModel>;
}

/**
 * Build the root form once the backend options are known. `form()` needs an
 * injection context, so we run it inside the caller's injector.
 */
export function createFlowForm(options: FlowOptions, injector: Injector): FlowForm {
  const model = signal<FlowModel>(emptyFlowModel(options));
  const tree = runInInjectionContext(injector, () => form(model, flowSchema(options)));
  return { model, form: tree };
}
