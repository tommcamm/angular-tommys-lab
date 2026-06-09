# Flow Compose

Experiment #4 in the Tommy Labs workspace: **Flow Forge v2**, a redesign of the
multi-step flow engine around a single architectural shift — **composition over
interpretation**. Where Flow Forge has the engine interpret a `FlowDef` (walking a
`steps[]` array, mounting components via `NgComponentOutlet`), Flow Compose makes each
flow a template that composes the engine's parts directly, the way you compose a CDK
stepper.

## The principle: composition over interpretation

In Flow Forge, the engine is an interpreter: you hand it a `FlowDef`, it decides how
to render each step. In Flow Compose, the engine is a set of composable primitives: a
`<tommy-flow-runner>` shell (owns the phase machine, footer buttons, step indicator,
error chrome, submit, and MitID plumbing) plus an `<ng-template flowStep>` structural
directive. The flow component authors its own template, weaving `flowStep` directives
into the runner the way an Angular CDK stepper consumer wires `<ng-template matStep>`.
No interpretation layer, no erased generics — what you write is what the compiler
checks.

## The contract

### `FlowRunner`

The shell component `<tommy-flow-runner [config]="config" [form]="form()" [loadError]="loadErrorMsg()" [resume]="signature()">`.

Owns (the flow author does not need to think about these):

- Phase machine (`intro → form → done | error`).
- Standard footer in every phase (Start; Back/Next/Submit; Start-over; Try-again).
- Step indicator and the frozen-error banner.
- Submit action through signal-forms `submit()`.
- 422 server-error folding onto the mapped step.
- 202 MitID signing_required: snapshot persist + redirect + return-URL plumbing.
- A standard error page for load failures (`[loadError]` non-null) and unexpected
  submit errors — **runner-owned chrome, no per-flow slot, free to every flow**.

Inputs:
- `config: FlowConfig<unknown>` — the flow's pure-data config (required).
- `form: FieldTree<unknown> | undefined` — built by the flow component, fed once env
  resolves (undefined = loading, runner stays in intro).
- `loadError: string | null` — the flow component passes its `env.error()` message
  here; triggers the standard error page.
- `resume: Signature | null` — a MitID callback signature; the runner re-submits when
  non-null and `form` is ready.

Outputs:
- `retry` — fired when the user clicks "Try again" on the load-error page; the flow
  component calls `env.reload()`.

### `FlowStep`

```ts
@Directive({ selector: 'ng-template[flowStep]' })
export class FlowStep<S = unknown> {
  readonly field = input.required<FieldTree<S>>({ alias: 'flowStep' });
  readonly key   = input.required<string>({ alias: 'flowStepKey' });
  readonly label = input.required<string>({ alias: 'flowStepLabel' });
}
```

The field slice **is** the directive's main input (`[flowStep]="form().contact"`). An
`ngTemplateContextGuard` reflects the slice type into the template context, so the
author's `let-field` is strongly typed:

```html
<ng-template
  flowStep
  [flowStep]="form()!.contact"
  flowStepKey="contact"
  flowStepLabel="Contact"
  let-field
  let-showErrors="showErrors"
>
  <tommy-contact-step [field]="field" [showErrors]="showErrors" />
</ng-template>
```

`FlowStepContext<S>` carries `$implicit: FieldTree<S>` and `showErrors: boolean`.

### `FlowIntro` / `FlowReceipt`

Two required per-flow content slots — the parts that genuinely vary per flow:

- `<ng-template flowIntro>` — the intro body (no context; closes over the flow's
  `env()` to show backend-driven copy).
- `<ng-template flowReceipt let-ok>` — the receipt body; receives `$implicit: SubmitOk`
  (includes `confirmationId`). Context type: `FlowReceiptContext`.

Both are required by the runner (`contentChild.required`). The runner renders them
inside its phase chrome; the flow author controls only the content.

### `FlowConfig<Model>`

The behavior-free configuration that replaces `FlowDef`:

```ts
interface FlowConfig<Model> {
  readonly meta: FlowMeta;             // slug, title, blurb, dimension
  readonly schemaVersion: number;      // bumped when snapshot shape changes
  toSubmission(model: Model): unknown;
  mapServerError?(e: ServerFieldError, form: FieldTree<Model>): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;    // read by runner on 202
  restore?(raw: unknown): Model;       // read by flow component on resume
}
```

No `buildForm`, no `steps[]`. Those live in the flow template now.

### `FlowResume`

A single-read service (provided in root). On boot, `FlowCompose` calls
`resume.consume(route.snapshot.queryParamMap, versionFn)` — `consume()` is the *single
reader* of the `sessionStorage` snapshot: it reads + clears the store if the `state`
nonce and schema version match, then caches the validated result in memory. The
auto-selected flow then calls `resume.pending(slug)`, read **once** by that flow's field
initializer to seed its restored model + a deferred `signature` (the runner re-submits
that signature via its `[resume]` input, *not* via `pending()`). `pending(slug)` is
**SINGLE-USE** — it clears the cached entry on return — so manually re-selecting a flow
later starts it **fresh** rather than re-resuming an already-signed request.

## How to add a flow

No engine changes required. Create `src/lib/flows/<name>/`:

1. **`model.ts`** — the form `Model` interface + `emptyModel(env)` factory.
2. **`schema.ts`** — a `schema<Model>(env)` builder; reuse `applyFeature` for
   feature-gated validators.
3. **`fixtures.ts`** — a `FlowFixture`: the `features` + `terms` maps + a
   deterministic `submit(payload)` returning a `SubmitOutcome`.
4. **`steps/*`** — one component per step (plus reuse the shared `tos-step` for
   terms-acceptance).
5. **`form.ts`** — a `buildForm(model, env, injector)` function that creates the
   signal-forms tree inside `runInInjectionContext(injector, …)`.
6. **`<name>-config.ts`** — the `FlowConfig<Model>` constant.
7. **`<name>-flow.ts`** — the flow component. It owns:
   - An `env` resource (`resource({ loader: () => backend.loadOptions(slug) })`).
   - A `model` signal (restored from `resume.pending(slug)` or from `emptyModel()`).
   - A `form` computed (builds only when `env.hasValue()`).
   - A `loadErrorMsg` computed (maps `env.error()` to a string).
   - A `signature` signal (deferred one render after `form()` exists, on resume).
   - An `effect` to seed env-derived tos defaults (skipped when resuming).
8. **`<name>-flow.html`** — the template. Wire `<tommy-flow-runner>` with `flowStep`,
   `flowIntro`, `flowReceipt` slots. Each `ng-template[flowStep]` takes a typed slice
   of the form.
9. Register in **`flow-cards.ts`** (the gallery card) and **`flow-fixtures.ts`** (the
   backend fixture map).
10. Add an **`@case`** branch in `flow-compose.html` for the new slug.
11. Add a **host registry entry** in
    `apps/tommy/host/src/app/experiments/registry.ts`.

Run `pnpm nx build tommy-host` after step 11 to confirm the AOT compiler accepts the
new flow's templates under `strictTemplates`.

## MitID round-trip

The seam-level round-trip is covered by
`src/lib/flows/bank/round-trip.spec.ts` (the `ExternalRedirect` and `FlowStateStore`
seams are faked — no real cross-origin navigation). The true cross-origin browser hop
is verified manually by running both the host app and the `mock-idp` app; the v2
return route is `/flow-compose` (cf. v1's `/flow-forge`).

## The ledger

### Gained (conceded out loud)

Flow Compose is **strictly better-typed than Flow Forge**. The improvements are real:

- `StepDef`, `defineStep()`, and the `StepComponent` interface are gone. With them go
  the per-step contract tests that existed only to compensate for the erased-generic
  `NgComponentOutlet` binding.
- The `FLOWS as AnyFlowDef[]` registry cast is gone. The `@switch` launcher is fully
  `strictTemplates`-checked — the compiler sees every flow component and every binding.
- `NgComponentOutlet` and its unchecked-inputs risk class are gone entirely. The runner
  no longer dynamically mounts components; it outlets `ng-template` content that the
  compiler already checked at the call site.
- Full AOT coverage: `pnpm nx build tommy-host` compiles `<tommy-flow-compose>` and
  every flow template (`newsletter`, `bank`, `insurance`) under `strictTemplates`.
  NG8002 / NG8022 errors are impossible to ship.
- A shape any Angular developer pattern-matches in five seconds: `<tommy-flow-runner>`
  + `<ng-template flowStep>` is the CDK-stepper pattern.

### Lost

Nicholas's *runtime* guarantee — an interpreter *cannot* let a registered flow deviate
from the contract — is traded for a *conventional* one: a flow component *doesn't*
deviate by construction and review. No code prevents an author from wiring a step
to the wrong slice; the compiler and tests do.

Each flow now carries **~55–90 lines of declarative repetition**: the env-resource +
model-signal + form-computed + loadErrorMsg + signature-deferral block in the `.ts`
file, plus the two required `flowIntro` and `flowReceipt` slots in the template. These
slots are required because they are the parts that genuinely vary per flow (intro copy
is typically env-driven; receipt copy includes flow-specific confirmation text). That
requirement raises the per-flow authoring cost over a defaults-based design — it is the
deliberate price of "every flow visibly declares its own intro and receipt." The error
page is **not** part of this cost: it is runner-owned chrome, free to every flow.

### Deferred (documented, not built)

Two follow-up items are explicitly deferred:

1. **Nx `flows:flow` generator** (`nx g …:flow <name>`) — stamps the canonical
   component, template, schema, model, and fixture files. This moves consistency
   enforcement from runtime (engine interprets) to creation time (generator stamps),
   with review guarding changes. The generator is the sharpest argument against the
   per-flow repetition cost: once you stamp 90 lines you stop thinking about them.
2. **Shared `flow-core` extraction** — the engine primitives (`wizard.ts`,
   `flow-backend.ts`, `flow-state-store.ts`, `mitid.ts`, `schema-helpers.ts`,
   `external-redirect.ts`) are currently duplicated verbatim from v1. A shared lib
   would de-dupe them, once v1 (`flow-forge`) can be retired.

## Running tests

```bash
pnpm nx test tommy-signal-forms-flow-compose   # runs all specs
pnpm nx lint tommy-signal-forms-flow-compose   # 0 errors (8 warnings, pre-existing)
pnpm nx build tommy-host                       # AOT strictTemplates gate
```
