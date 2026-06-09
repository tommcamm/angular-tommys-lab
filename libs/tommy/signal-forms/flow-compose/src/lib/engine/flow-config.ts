import type { FieldTree } from '@angular/forms/signals';
import type { FlowMeta, ServerFieldError } from './flow-types';

/**
 * A flow's behavior-free configuration. The engine no longer interprets `buildForm`
 * or a `steps[]` array — those are the flow component's template now. `snapshot` is
 * read by the runner (on 202); `restore` is read by the flow component (on resume).
 */
export interface FlowConfig<Model> {
  readonly meta: FlowMeta;
  readonly schemaVersion: number;
  toSubmission(model: Model): unknown;
  mapServerError?(
    e: ServerFieldError,
    form: FieldTree<Model>,
  ): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;
  restore?(raw: unknown): Model;
}
