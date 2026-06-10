# Flow Compose — structure & boilerplate refactor

**Date:** 2026-06-10
**Library:** `libs/tommy/signal-forms/flow-compose` (`@tommy/signal-forms-flow-compose`)
**Type:** Structure + dedupe refactor. **No behavior change.**

## Problem

Flow Compose works and is well-typed, but two things make it harder to read and to
extend than it should be:

1. **The `engine/` folder is a 14-file grab-bag** mixing four unrelated concerns — the
   composition contract (`flow-runner`, `flow-step`, `flow-slots`, `flow-config`), a
   runtime primitive (`wizard`), backend/IO seams (`flow-backend`, `flow-state-store`,
   `flow-resume`, `resume`, `mitid`, `external-redirect`), and a util (`schema-helpers`).
   "Engine" is also the *wrong name*: Flow **Forge** is an engine (it interprets a
   `FlowDef`); Flow **Compose** has no interpreter — it's a kit of composable parts.

2. **Every flow repeats ~55 lines of identical wiring**, plus a per-flow `form.ts` file
   whose only job is to wrap `form()` in `untracked(runInInjectionContext(...))`. The
   three flow components (`bank`, `insurance`, `newsletter`) are byte-identical after
   name substitution except for the slug, `Model` type, schema fn, `emptyModel`, and a
   one-line `tos` seed. ~170 duplicated lines carrying no flow-specific information.

## Goals

- Replace `engine/` with concern-named folders; drop the "engine" name.
- Delete the three per-flow `form.ts` files and the `runInInjectionContext` indirection.
- Introduce a `createFlow()` composable that absorbs the repeated per-flow wiring so a
  flow component shrinks from ~66 lines to ~14.
- Preserve the README's "composition over interpretation" thesis: the flow still owns
  its template and the compiler still checks every step slice. We remove *plumbing*
  repetition, not *composition*.

## Non-goals (explicitly out of scope)

- **No behavior change.** Phase machine, MitID round-trip, resume timing, server-error
  folding, submit lifecycle — all identical.
- **No flow-registration overhaul.** The 4–5 registration touchpoints (`flow-cards.ts`,
  `flow-fixtures.ts`, the `@case` in `flow-compose.html`, the host registry) stay as-is.
  Consolidating them is a separate, larger effort (noted under Deferred).
- **No shared-core extraction with `flow-forge`.** The IO seams are still duplicated
  verbatim between the two libs; de-duping them waits until v1 is retired (Deferred).
- **No Nx `flows:flow` generator** (Deferred).

## Key finding (why this is safe)

`form(model, schema)` only needs an injection context because of one internal line —
it falls back to `inject(Injector)` when not given one
(`@angular/forms/.../_validation_errors-chunk.mjs:1575`:
`const injector = options?.injector ?? inject(Injector)`). `form()`'s third arg is a
`FormOptions` with an `injector` field. So:

```ts
untracked(() => runInInjectionContext(injector, () => form(model, bankSchema(env))))
// becomes
untracked(() => form(model, bankSchema(env), { injector }))
```

- `runInInjectionContext` → **removed** via the `{ injector }` option.
- `untracked` → **kept**. Unrelated to DI: the form is built inside a `computed`, and
  `form()` registers an internal `effect()`, which Angular forbids inside a reactive
  context. `untracked` is the escape — cheap and correct.

## Design

### 1. Folder layout (move map)

`engine/` is deleted; its files split into `runner/`, `io/`, `forms/`, plus two root
modules. Each `*.spec.ts` moves with its source.

| Old | New |
|---|---|
| `engine/flow-runner.ts` / `.html` | `runner/flow-runner.ts` / `.html` |
| `engine/flow-step.ts` | `runner/flow-step.ts` |
| `engine/flow-slots.ts` | `runner/flow-slots.ts` |
| `engine/flow-config.ts` | `runner/flow-config.ts` |
| `engine/wizard.ts` | `runner/wizard.ts` (runner's private state machine) |
| `engine/testing/test-host.ts` | `runner/testing/test-host.ts` |
| `engine/flow-backend.ts` | `io/flow-backend.ts` |
| `engine/flow-state-store.ts` | `io/flow-state-store.ts` |
| `engine/flow-resume.ts` | `io/flow-resume.ts` (absorbs `PendingResume`) |
| `engine/resume.ts` | **deleted** — `PendingResume` type moved into `io/flow-resume.ts` |
| `engine/mitid.ts` | `io/mitid.ts` |
| `engine/external-redirect.ts` | `io/external-redirect.ts` |
| `engine/schema-helpers.ts` | `forms/schema-helpers.ts` |
| `engine/flow-types.ts` | `flow-types.ts` (root — shared vocabulary) |
| — | `forms/build-flow-form.ts` (**new**) |
| — | `create-flow.ts` (**new**, root) |
| `flows/*/form.ts` (×3) | **deleted** |

Resulting `src/lib/` tree:

```
src/lib/
  runner/        flow-runner.ts/.html, flow-step.ts, flow-slots.ts,
                 flow-config.ts, wizard.ts, testing/test-host.ts
  io/            flow-backend.ts, flow-state-store.ts, flow-resume.ts,
                 mitid.ts, external-redirect.ts
  forms/         schema-helpers.ts, build-flow-form.ts
  flow-types.ts
  create-flow.ts
  flows/  ui/  steps/
  flow-compose.ts/.html, flow-cards.ts, flow-fixtures.ts
```

### 2. `forms/build-flow-form.ts` (new)

The one subtle line in the library, named and separately tested:

```ts
import { Injector, WritableSignal, untracked } from '@angular/core';
import { form, type FieldTree } from '@angular/forms/signals';
import type { FlowEnvelope } from '../flow-types';

export function buildFlowForm<M>(
  model: WritableSignal<M>,
  schema: (env: FlowEnvelope) => ReturnType<typeof import('@angular/forms/signals').schema<M>>,
  env: FlowEnvelope,
  injector: Injector,
): FieldTree<M> {
  // untracked: built inside a computed, and form() registers an internal effect.
  // { injector }: passes DI explicitly so no runInInjectionContext wrapper is needed.
  return untracked(() => form(model, schema(env), { injector }));
}
```

> The exact type of the `schema` parameter is resolved at implementation to whatever
> `schema<M>()` returns in this Angular version; the signature above is the intent.

### 3. `create-flow.ts` (new)

Run from a flow component's field initializer (which *is* an injection context). Absorbs
the wiring currently copy-pasted into each flow component — same logic, hoisted once.

```ts
export interface CreateFlowOptions<M> {
  config: FlowConfig<M>;                              // meta.slug, schemaVersion, restore
  schema: (env: FlowEnvelope) => /* schema<M> */;
  emptyModel: () => M;
  seedDefaults?: (model: M, env: FlowEnvelope) => M;  // optional; default no-op
  loadErrorMessage?: string;                          // default copy provided
}

export interface Flow<M> {
  readonly config: FlowConfig<M>;
  readonly env: ResourceRef<FlowEnvelope>;
  readonly model: WritableSignal<M>;
  readonly form: Signal<FieldTree<M> | undefined>;
  readonly loadErrorMsg: Signal<string | null>;
  readonly signature: Signal<Signature | null>;
}

export function createFlow<M>(opts: CreateFlowOptions<M>): Flow<M> {
  const injector = inject(Injector);
  const backend  = inject(FlowBackend);
  const resume   = inject(FlowResume);
  const slug     = opts.config.meta.slug;
  const pending  = resume.pending(slug);

  const env   = resource({ loader: () => backend.loadOptions(slug) });
  const model = signal<M>(pending
    ? (opts.config.restore?.(pending.model) ?? pending.model) as M
    : opts.emptyModel());
  const form  = computed(() =>
    env.hasValue() ? buildFlowForm(model, opts.schema, env.value()!, injector) : undefined);
  const loadErrorMsg = computed(() =>
    env.error() ? (opts.loadErrorMessage ?? 'Could not start this flow. Please retry.') : null);
  const signature = signal<Signature | null>(null);

  if (opts.seedDefaults) effect(() => {            // seed env defaults once, skip on resume
    if (pending || !env.hasValue()) return;
    model.update((m) => opts.seedDefaults!(m, env.value()!));
  });

  const sig = pending?.signature;                  // resume: defer signature one render
  if (sig) { let armed = false; effect(() => {
    if (armed || !form()) return; armed = true;
    afterNextRender(() => signature.set(sig), { injector });
  }); }

  return { config: opts.config, env, model, form, loadErrorMsg, signature };
}
```

### 4. Flow component & template after

```ts
// flows/bank/bank-flow.ts — ~14 lines
@Component({
  selector: 'tommy-bank-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, ApplicantStep, AccountTypeStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bank-flow.html',
})
export class BankFlow {
  protected readonly flow = createFlow<BankModel>({
    config: BANK_FLOW_CONFIG,
    schema: bankSchema,
    emptyModel: emptyBankModel,
    seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }),
  });
}
```

Template changes are a mechanical `flow.` prefix; typed step slices are untouched:

```html
<tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                   [resume]="flow.signature()" (retry)="flow.env.reload()">
  <ng-template flowIntro> … @if (flow.env.isLoading()) { … } </ng-template>

  @if (flow.form(); as form) {
    <ng-template [flowStep]="form.applicant" flowStepKey="applicant" flowStepLabel="Applicant"
                 let-field let-showErrors="showErrors">
      <tommy-bank-applicant-step [field]="field" [showErrors]="showErrors" />
    </ng-template>
    <!-- account, tos slices unchanged; tos uses flow.env.value()!.terms -->
  }

  <ng-template flowReceipt let-result> … </ng-template>
</tommy-flow-runner>
```

Apply the identical transform to `insurance` and `newsletter` (all three seed `tos` via
`seedDefaults` — every model carries a `tos` field).

### 5. Public API (`index.ts`)

Same exports, re-pathed to the new folders, **plus** the new authoring API:

```ts
export { FlowCompose } from './lib/flow-compose';
export { FlowRunner } from './lib/runner/flow-runner';
export { FlowStep, type FlowStepContext } from './lib/runner/flow-step';
export { FlowIntro, FlowReceipt, type FlowReceiptContext } from './lib/runner/flow-slots';
export type { FlowConfig } from './lib/runner/flow-config';
export { createFlow, type CreateFlowOptions, type Flow } from './lib/create-flow';
export { buildFlowForm } from './lib/forms/build-flow-form';
export type {
  FlowMeta, FlowEnvelope, FeatureMap, FeatureDescriptor, TermsMap, TermDescriptor,
  ServerFieldError, Signature, SubmitOk, SubmitOutcome,
} from './lib/flow-types';
```

### 6. README

Update `README.md`: the file-tree / "How to add a flow" sections (no more `form.ts`;
new folder names; `createFlow` step), and the "ledger" — the "~55–90 lines of
declarative repetition" cost is the thing this refactor erases, so that paragraph and
the related "Deferred → generator" framing get rewritten to reflect `createFlow`.

## Migration order

1. Move `engine/` files into `runner/`, `io/`, `forms/`; move `flow-types.ts` to root;
   merge `resume.ts`'s `PendingResume` into `io/flow-resume.ts`. Fix all import paths
   (sources + specs + `flows/*` + `ui/*` + `flow-compose.ts` + `index.ts`). Build green.
2. Add `forms/build-flow-form.ts` + `build-flow-form.spec.ts`.
3. Add `create-flow.ts` + `create-flow.spec.ts`.
4. Migrate the three flow components + templates to `createFlow`; delete the three
   `flows/*/form.ts` files.
5. Update `index.ts` and `README.md`.

## Verification

- `pnpm nx test tommy-signal-forms-flow-compose` — full spec suite green, incl.
  `flows/bank/round-trip.spec.ts` (the MitID seam round-trip).
- `pnpm nx build tommy-host` — AOT `strictTemplates` gate (the only real template check;
  the lib's `typecheck` is plain `tsc` and misses NG8022).
- `pnpm nx lint tommy-signal-forms-flow-compose` — 0 errors (8 pre-existing warnings ok).

New tests:
- `build-flow-form.spec.ts` — documents the `untracked` + `{ injector }` contract:
  building inside a `computed` does not throw; the form is usable.
- `create-flow.spec.ts` — fresh vs. resume model seeding; `seedDefaults` skipped on
  resume; `loadErrorMsg` maps `env.error()`; `signature` deferred until `form()` exists.

## Risks

- **Import-path churn** across many files (mechanical; the AOT build + test suite catch
  misses). Largest single risk, lowest severity.
- **`createFlow` must run in an injection context.** Guaranteed by calling it from a
  field initializer; documented in the function's doc comment and asserted by its spec.
- **Resume timing.** The signature-deferral `afterNextRender` logic is moved verbatim
  into `createFlow`; `round-trip.spec.ts` guards it. No timing change intended.

## Deferred (documented, not built)

1. Consolidate the 4–5 flow-registration touchpoints into a single registry.
2. Extract the duplicated `io/` seams into a lib shared with `flow-forge`, once v1 is
   retired.
3. Nx `flows:flow` generator that stamps a new flow's files.
