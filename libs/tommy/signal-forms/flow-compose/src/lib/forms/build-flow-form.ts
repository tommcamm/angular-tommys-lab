import { Injector, untracked, type WritableSignal } from '@angular/core';
import { form, type FieldTree, type SchemaOrSchemaFn } from '@angular/forms/signals';
import type { FlowEnvelope } from '../flow-types';

/**
 * Build a signal-forms `form()` for a flow, lazily, from outside a clean injection
 * context. Two subtleties, both handled here so flow code never repeats them:
 *
 * - `{ injector }`: `form()` falls back to `inject(Injector)` when no injector is
 *   given, which throws outside an injection context. Passing the captured injector
 *   removes that requirement — no `runInInjectionContext` wrapper needed.
 * - `untracked`: callers build this inside a `computed`, and `form()` registers an
 *   internal `effect()`, which Angular forbids in a reactive context. `untracked`
 *   escapes the consumer so the effect can be created.
 */
export function buildFlowForm<M>(
  model: WritableSignal<M>,
  schemaFn: (env: FlowEnvelope) => SchemaOrSchemaFn<M>,
  env: FlowEnvelope,
  injector: Injector,
): FieldTree<M> {
  return untracked(() => form(model, schemaFn(env), { injector }));
}
