# Flow Forge

Experiment #3 in the Tommy Labs workspace: a **composable engine for signal-forms
multi-step flows**, built on Angular 21's experimental signal forms
(`@angular/forms/signals`). Where experiment #2
(`@tommy/signal-forms/multi-step-form`) is one hand-wired wizard, Flow Forge factors
the wizard apart so that **one skeleton powers many flows**.

## The principle: standardize the skeleton, free the flesh

A shared **engine** owns everything that is the same across flows — phase/step
orchestration, validity gating, dynamic step rendering, the backend round-trip, the
submit state machine, and the MitID redirect plumbing. Each **flow** contributes only
its content: a form model, a schema, step components, a submission mapper, and a
fixture. Adding a flow touches no engine code.

## The engine pieces

All under `src/lib/engine/`:

| File                  | Responsibility                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flow-def.ts`         | The contract: `FlowDef`, `FlowMeta`, `StepDef`/`defineStep`/`StepComponent`, the `{ features, terms }` envelope types, and the `SubmitOutcome` union.          |
| `wizard.ts`           | `createWizard()` — a headless phase/step/gate controller. Validity is captured as a **frozen snapshot** per step (`null` = not validated, `[]` = clean, `[…]` = frozen banner messages). |
| `flow-runner.ts`      | The `<tommy-flow-runner [def]>` component: phase chrome, dynamic step via `NgComponentOutlet`, and submit through signal-forms `submit()`.                      |
| `flow-backend.ts`     | One shared `FlowBackend` service: GET options + POST submit **by slug**, reading the `FLOW_FIXTURES` registry. Stand-in for a single real HTTP backend.        |
| `flow-state-store.ts` | `FlowStateStore` — a versioned, single-use `sessionStorage` snapshot that survives the MitID redirect (the full page unloads).                                  |
| `mitid.ts`            | MitID URL helpers: `buildReturnUrl` (this origin), `isSameOrigin` (same-origin guard, no open redirect), and `parseCallback`.                                  |
| `schema-helpers.ts`   | `applyFeature` — a feature-aware, reusable validator that reads a descriptor's shared base (`mandatory`, length bounds) and applies the matching signal-forms validators. |

Supporting UI lives under `src/lib/ui/` (`flow-shell`, `step-indicator`,
`error-banner`, `field-error`, the `.ui-*` design layer in `ui.css`) and a shared
`src/lib/steps/tos-step.ts` (the terms-acceptance step reused by any flow).
`FlowRunner` redirects via an injectable `ExternalRedirect` (`engine/external-redirect.ts`)
so the navigation is mockable in tests.

## The `FlowDef` contract

A flow is a single object implementing `FlowDef<Model>` (`engine/flow-def.ts`):

```ts
export interface FlowDef<Model, Features extends FeatureMap = FeatureMap> {
  readonly meta: FlowMeta;                // slug, title, blurb, intro, dimension
  readonly schemaVersion: number;         // bumped when the snapshot shape changes
  buildForm(env: FlowEnvelope<Features>, injector: Injector): FlowForm<Model>;
  readonly steps: readonly StepDef<Model>[];
  toSubmission(model: Model): unknown;     // model → POST payload
  mapServerError?(err, form): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;        // override JSON snapshot (MitID round-trip)
  restore?(raw: unknown): Model;           // override JSON restore
}
```

`buildForm` builds the signal-forms tree from the loaded `env`, inside
`runInInjectionContext(injector, …)` (signal forms' `form()` needs an injection
context). `toSubmission` is the only required mapping from model to wire payload.
The three optional hooks cover server-error placement (`mapServerError`) and a custom
snapshot/restore for models that aren't plain-JSON-safe.

### Steps: `defineStep` + `StepComponent`

Each step is an ordinary Angular component implementing `StepComponent<Slice, Data>`
and bound by the engine through a **fixed input set**:

```ts
export interface StepComponent<Slice, Data = never> {
  readonly field: InputSignal<FieldTree<Slice>>;   // the step's slice of the form
  readonly showErrors: InputSignal<boolean>;       // gate-driven error visibility
  readonly data?: InputSignal<Data>;               // optional per-step backend data
}
```

`defineStep({ key, label, component, field, data? })` ties a component to its slice
(`field: (form) => form.contact`) and, optionally, derives per-step data from the
envelope (`data: (env) => env.terms`). The runner binds `field`/`showErrors` always
and `data` only when the step declares it (so `NgComponentOutlet` doesn't warn about
an unknown input).

## The `{ features, terms }` backend envelope

Every flow loads the **same shape** of options — a `FlowEnvelope`:

```ts
interface FlowEnvelope<Features extends FeatureMap = FeatureMap> {
  readonly features: Features;   // keyed map of FeatureDescriptor  ({ mandatory, … })
  readonly terms: TermsMap;      // keyed map of TermDescriptor      ({ title, body, required })
}
```

Both `features` and `terms` are **keyed maps of descriptors sharing a common base**.
The *key set* differs per flow (newsletter uses `NAME`/`EMAIL`; later flows add their
own), but the *structure* stays uniform — which is exactly what lets `applyFeature`
and the shared `tos-step` work across every flow.

## Submit outcomes + MitID

`submit()` calls the shared backend; the action returns one of three outcomes
(`SubmitOutcome`), modelled on real HTTP status semantics:

- **200 `ok`** → set the confirmation id and move to the `done` phase.
- **422 `rejected`** → fold each `ServerFieldError` back onto the form (via
  `mapServerError` when provided, else the root node), freeze a banner on the mapped
  step, and navigate there.
- **202 `signing_required`** → persist a single-use snapshot (`FlowStateStore`) with a
  correlation `state` nonce, then redirect to the signing URL with `state` + a
  same-origin `return` URL.

### MitID round-trip

The bank flow's full step-up is now wired end to end through the seams:

1. **submit → 202 `signing_required`** — the backend returns a `signingUrl` (pointing
   at the `mock-idp` app, dev port 4300) and a `challengeId`.
2. **persist + redirect** — the engine saves a single-use `FlowStateStore` snapshot
   (model + `challengeId` + a `state` nonce), then redirects to the signing URL with
   that `state` and a same-origin `return` URL (`/flow-forge?mitid=callback&flow=bank`).
3. **user approves** — the `mock-idp` provider app (`apps/tommy/mock-idp`) approves the
   challenge and navigates back to the `return` URL, echoing the `state` plus a
   one-time `code`.
4. **launcher validates + rehydrates** — the launcher (`flow-forge.ts`) checks the
   returned `state` against the snapshot's, restores the model, and builds the
   `ResumeData` (`{ model, signature: { challengeId, code } }`).
5. **runner re-submits → 200 → done** — a fresh `FlowRunner` mounted with `[resume]`
   re-fetches options, rebuilds the form, jumps to the last step, and re-submits with
   the one-time signature; the backend now returns 200 `ok` and the flow lands on `done`
   with a `BANK-` confirmation id.

The seam-level round-trip is covered by `flows/bank/round-trip.spec.ts` (the
`ExternalRedirect` and `FlowStateStore` seams are faked — no real cross-origin
navigation). The *true* cross-origin browser hop is verified manually by running both
the host and `mock-idp` apps (see the root README).

## How to add a flow

No engine changes required. Create `src/lib/flows/<name>/`:

1. **`model.ts`** — the form `Model` interface + an `emptyModel(env)` factory.
2. **`schema.ts`** — a `schema<Model>(…)` builder, parameterized by `env`; reuse
   `applyFeature` for feature-gated validators.
3. **`fixtures.ts`** — a `FlowFixture`: the `features` + `terms` maps and a
   deterministic `submit(payload)` returning a `SubmitOutcome`.
4. **`steps/*`** — one component per step implementing `StepComponent` (reuse the
   shared `tos-step` for terms).
5. **`def.ts`** — the `FlowDef`: `meta`, `schemaVersion`, `buildForm`, the
   `defineStep(…)` list, `toSubmission`, and any optional hooks.

Then register both halves in `src/lib/flow-registry.ts`:

```ts
export const FLOWS = [..., myFlow as AnyFlowDef];
export const FIXTURES = new Map([..., ['my-slug', myFixture as FlowFixture]]);
```

The launcher gallery, the runner, and the backend pick it up automatically.

## Status

All three flows now ship on top of the shared engine and launcher gallery
(`flow-forge.ts`):

- **newsletter** (`flows/newsletter/`) — the minimal flow (name + email + consent).
- **insurance** (`flows/insurance/`) — complex fields: a dynamic array, a conditional
  section, and a cross-field rule.
- **bank** (`flows/bank/`) — MitID signing, with the full 202 → redirect → callback →
  resume → 200 round-trip now wired (see *MitID round-trip* above) and the cross-origin
  `mock-idp` provider app (`apps/tommy/mock-idp`).

## Running unit tests

Run `pnpm nx test tommy-signal-forms-flow-forge` to execute the unit tests — the
engine (wizard, backend, state store, mitid, schema helpers, runner) and the
newsletter schema are all covered.
