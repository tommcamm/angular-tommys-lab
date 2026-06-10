import {
  Injector, afterNextRender, computed, effect, inject, resource, signal,
  type ResourceRef, type Signal, type WritableSignal,
} from '@angular/core';
import type { FieldTree, SchemaOrSchemaFn } from '@angular/forms/signals';
import { FlowBackend } from './io/flow-backend';
import { FlowResume } from './io/flow-resume';
import type { FlowConfig } from './runner/flow-config';
import type { FlowEnvelope, Signature } from './flow-types';
import { buildFlowForm } from './forms/build-flow-form';

const DEFAULT_LOAD_ERROR = 'Could not start this flow. Please retry.';

export interface CreateFlowOptions<M> {
  /** The flow's behaviour-free config; supplies `meta.slug`, `schemaVersion`, `restore`. */
  readonly config: FlowConfig<M>;
  /** The flow's signal-forms schema builder, keyed off the loaded env. */
  readonly schema: (env: FlowEnvelope) => SchemaOrSchemaFn<M>;
  /** The env-free starting model. */
  readonly emptyModel: () => M;
  /** Optional: derive defaults from env once it resolves (e.g. the tos[] array). Skipped on resume. */
  readonly seedDefaults?: (model: M, env: FlowEnvelope) => M;
  /** Optional: override the default load-error copy. */
  readonly loadErrorMessage?: string;
}

export interface Flow<M> {
  readonly config: FlowConfig<M>;
  readonly env: ResourceRef<FlowEnvelope | undefined>;
  readonly model: WritableSignal<M>;
  readonly form: Signal<FieldTree<M> | undefined>;
  readonly loadErrorMsg: Signal<string | null>;
  readonly signature: Signal<Signature | null>;
}

/**
 * Hoists the per-flow wiring (env resource, model signal, lazy form, load-error mapping,
 * MitID resume seeding + signature deferral) into one composable. Call it from a flow
 * component's field initializer — that runs in an injection context, satisfying
 * `inject()`, `resource()`, `effect()`, and the captured `Injector` used by
 * `buildFlowForm` and `afterNextRender`.
 */
export function createFlow<M>(opts: CreateFlowOptions<M>): Flow<M> {
  const injector = inject(Injector);
  const backend = inject(FlowBackend);
  const resume = inject(FlowResume);
  const slug = opts.config.meta.slug;
  const pending = resume.pending(slug);

  const env = resource({ loader: () => backend.loadOptions(slug) });

  const model = signal<M>(
    pending
      ? ((opts.config.restore?.(pending.model) ?? pending.model) as M)
      : opts.emptyModel(),
  );

  const form = computed(() =>
    env.hasValue() ? buildFlowForm(model, opts.schema, env.value()!, injector) : undefined,
  );

  const loadErrorMsg = computed(() =>
    env.error() ? (opts.loadErrorMessage ?? DEFAULT_LOAD_ERROR) : null,
  );

  const signature = signal<Signature | null>(null);

  // Seed env-derived defaults once env resolves — NOT when resuming (the restored model
  // already carries the user's answers).
  const seed = opts.seedDefaults;
  if (seed) {
    effect(() => {
      if (pending || !env.hasValue()) return;
      model.update((m) => seed(m, env.value()!));
    });
  }

  // Resume: once the form exists, defer the signature one render so the step templates'
  // `[flowStep]` inputs are committed before the runner reads them and re-submits.
  const sig = pending?.signature;
  if (sig) {
    let scheduled = false;
    effect(() => {
      if (scheduled || !form()) return;
      scheduled = true;
      afterNextRender(() => signature.set(sig), { injector });
    });
  }

  return { config: opts.config, env, model, form, loadErrorMsg, signature };
}
