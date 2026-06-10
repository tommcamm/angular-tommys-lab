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

The shell component lives in `runner/flow-runner.ts`. A flow template wires it as:

```html
<tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                   [resume]="flow.signature()" (retry)="flow.env.reload()">
```

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
- `config: FlowConfig<unknown>` — the flow's pure-data config (required). See
  `runner/flow-config.ts`.
- `form: FieldTree<unknown> | undefined` — produced by `createFlow`; `undefined` while
  env is loading (runner stays in intro).
- `loadError: string | null` — non-null triggers the standard error page; bound from
  `flow.loadErrorMsg()`.
- `resume: Signature | null` — a MitID callback signature; the runner re-submits when
  non-null and `form` is ready.

Outputs:
- `retry` — fired when the user clicks "Try again" on the load-error page; call
  `flow.env.reload()`.

### `FlowStep`

Lives in `runner/flow-step.ts`.

```ts
@Directive({ selector: 'ng-template[flowStep]' })
export class FlowStep<S = unknown> {
  readonly field = input.required<FieldTree<S>>({ alias: 'flowStep' });
  readonly key   = input.required<string>({ alias: 'flowStepKey' });
  readonly label = input.required<string>({ alias: 'flowStepLabel' });
}
```

The field slice **is** the directive's main input. An `ngTemplateContextGuard` reflects
the slice type into the template context, so the author's `let-field` is strongly typed.
Guard the `@if (flow.form(); as form)` block so the form is non-nullable inside it:

```html
@if (flow.form(); as form) {
  <ng-template [flowStep]="form.contact" flowStepKey="contact" flowStepLabel="Contact"
               let-field let-showErrors="showErrors">
    <tommy-contact-step [field]="field" [showErrors]="showErrors" />
  </ng-template>
}
```

`FlowStepContext<S>` carries `$implicit: FieldTree<S>` and `showErrors: boolean`.

### `FlowIntro` / `FlowReceipt`

Both live in `runner/flow-slots.ts`. Two required per-flow content slots — the parts
that genuinely vary per flow:

- `<ng-template flowIntro>` — the intro body (no context; closes over `flow.env` to
  show backend-driven copy).
- `<ng-template flowReceipt let-result>` — the receipt body; receives
  `$implicit: SubmitOk` (includes `confirmationId`). Context type: `FlowReceiptContext`.

Both are required by the runner (`contentChild.required`). The runner renders them
inside its phase chrome; the flow author controls only the content.

### `FlowConfig<Model>`

Lives in `runner/flow-config.ts`. The behavior-free configuration that replaces
`FlowDef`:

```ts
interface FlowConfig<Model> {
  readonly meta: FlowMeta;             // slug, title, blurb, dimension
  readonly schemaVersion: number;      // bumped when snapshot shape changes
  toSubmission(model: Model): unknown;
  mapServerError?(e: ServerFieldError, form: FieldTree<Model>): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;    // read by runner on 202
  restore?(raw: unknown): Model;       // read by createFlow on resume
}
```

No `buildForm`, no `steps[]`. Schema building is handled by `createFlow` (via
`forms/build-flow-form.ts`); steps live in the flow template.

### `FlowResume`

Lives in `io/flow-resume.ts`. A single-read service (provided in root). On boot,
`FlowCompose` calls `resume.consume(route.snapshot.queryParamMap, versionFn)` —
`consume()` is the *single reader* of the `sessionStorage` snapshot: it reads + clears
the store if the `state` nonce and schema version match, then caches the validated
result in memory. `createFlow` then calls `resume.pending(slug)` **once** from the
flow's field initializer to seed the restored model + schedule the deferred `signature`
(the runner re-submits that signature via its `[resume]` input, *not* via `pending()`).
`pending(slug)` is **SINGLE-USE** — it clears the cached entry on return — so manually
re-selecting a flow later starts it **fresh** rather than re-resuming an already-signed
request. `PendingResume` is defined in `io/flow-resume.ts` alongside the service.

## How to add a flow

No engine changes required. Create `src/lib/flows/<name>/`:

1. **`model.ts`** — the form `Model` interface + `emptyModel()` factory.
2. **`schema.ts`** — a `schema<Model>(env)` builder; reuse `applyFeature` from
   `forms/schema-helpers` for feature-gated validators.
3. **`fixtures.ts`** — a `FlowFixture`: the `features` + `terms` maps + a
   deterministic `submit(payload)` returning a `SubmitOutcome`.
4. **`steps/*`** — one component per step (plus reuse the shared `tos-step` for
   terms-acceptance).
5. **`<name>-config.ts`** — the `FlowConfig<Model>` constant (`runner/flow-config.ts`).
6. **`<name>-flow.ts`** — the flow component. All per-flow wiring is handled by
   `createFlow` from `create-flow.ts`; the component body is simply:

   ```ts
   @Component({ selector: 'tommy-<name>-flow', imports: [FlowRunner, FlowStep,
     FlowIntro, FlowReceipt, /* step components */],
     changeDetection: ChangeDetectionStrategy.OnPush,
     templateUrl: './<name>-flow.html' })
   export class NameFlow {
     protected readonly flow = createFlow<NameModel>({
       config: NAME_FLOW_CONFIG,
       schema: nameSchema,
       emptyModel: emptyNameModel,
       seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }), // if needed
     });
   }
   ```

   `createFlow` handles: env resource, model signal, lazy form computed,
   `loadErrorMsg`, `seedDefaults` effect, and MitID resume / signature deferral.

7. **`<name>-flow.html`** — the template. Wire `<tommy-flow-runner>` with
   `flow.`-prefixed bindings (`flow.config`, `flow.form()`, `flow.loadErrorMsg()`,
   `flow.signature()`, `flow.env.reload()`). Add the required `flowIntro` and
   `flowReceipt` slots, and guard `flowStep` directives in an
   `@if (flow.form(); as form)` block so form slices are non-nullable.
8. Register in **`flow-cards.ts`** (the gallery card) and **`flow-fixtures.ts`** (the
   backend fixture map).
9. Add an **`@case`** branch in `flow-compose.html` for the new slug.
10. Add a **host registry entry** in
    `apps/tommy/host/src/app/experiments/registry.ts`.

Run `pnpm nx build tommy-host` after step 10 to confirm the AOT compiler accepts the
new flow's templates under `strictTemplates`.

## MitID round-trip

The seam-level round-trip is covered by
`src/lib/flows/bank/round-trip.spec.ts` — the `ExternalRedirect` and `FlowStateStore`
seams (`io/external-redirect.ts`, `io/flow-state-store.ts`) are faked, so there is no real
cross-origin navigation. The true cross-origin browser hop is verified manually by running both the
host app and the `mock-idp` app; the v2 return route is `/flow-compose` (cf. v1's
`/flow-forge`).

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
- **`createFlow` + `buildFlowForm` erase the per-flow boilerplate.** The env-resource,
  model signal, lazy form computed, `loadErrorMsg`, `seedDefaults` effect, and MitID
  resume / signature-deferral wiring are hoisted once into `create-flow.ts`
  (`forms/build-flow-form.ts` handles the `form()` call with an `Injector` option,
  removing the old `runInInjectionContext` dance entirely). A new flow component is now
  ~14 lines of `@Component` metadata plus a single `createFlow({...})` field.

### Lost

Nicholas's *runtime* guarantee — an interpreter *cannot* let a registered flow deviate
from the contract — is traded for a *conventional* one: a flow component *doesn't*
deviate by construction and review. No code prevents an author from wiring a step
to the wrong slice; the compiler and tests do.

The per-flow `.ts` wiring cost that existed before `createFlow` (~55–90 lines of
env-resource + model-signal + form-computed + loadErrorMsg + signature-deferral) is now
gone. What remains per flow is genuinely variable: the `createFlow({...})` config
object (schema, emptyModel, optional seedDefaults) and the two required template slots
(`flowIntro` and `flowReceipt`). These slots are required because they are the parts
that genuinely vary per flow — intro copy is typically env-driven; receipt copy includes
flow-specific confirmation text. That requirement is the deliberate price of "every flow
visibly declares its own intro and receipt." The error page is **not** part of this
cost: it is runner-owned chrome, free to every flow.

### Deferred (documented, not built)

Two follow-up items are explicitly deferred:

1. **Nx `flows:flow` generator** (`nx g …:flow <name>`) — stamps the small canonical
   shell: a `createFlow({...})` component + template + schema + model + fixture files.
   Now that `createFlow` handles the per-flow wiring, the generator would stamp a
   light skeleton rather than 90 lines of boilerplate, so the urgency is lower — it
   remains a nice-to-have for consistency enforcement at creation time.
2. **Shared `flow-core` extraction** — the engine primitives (`runner/wizard.ts`,
   `io/flow-backend.ts`, `io/flow-state-store.ts`, `io/mitid.ts`,
   `forms/schema-helpers.ts`, `io/external-redirect.ts`) are currently duplicated
   verbatim from v1. A shared lib would de-dupe them, once v1 (`flow-forge`) can be
   retired.

## Running tests

```bash
pnpm nx test tommy-signal-forms-flow-compose   # runs all specs
pnpm nx lint tommy-signal-forms-flow-compose   # 0 errors (8 warnings, pre-existing)
pnpm nx build tommy-host                       # AOT strictTemplates gate
```
