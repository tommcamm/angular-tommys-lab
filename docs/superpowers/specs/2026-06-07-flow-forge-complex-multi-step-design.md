# Flow Forge — a composable standard for signal-forms multi-step flows

**Date:** 2026-06-07
**Experiment:** Flow Forge (`flow-forge`), grouped under *Signal Forms*
**Status:** Design approved, ready for implementation plan

## Summary

Flow Forge is experiment #3 in Tommy's Angular Lab. It is not a single wizard — it
is a **development standard** for building 30+ multi-step flows on Angular signal
forms, demonstrated by three concrete flows that each stress a different dimension.

The governing principle is **standardize the skeleton, free the flesh**: a shared
*engine* owns everything identical across all flows (the phase machine, per-step
validity gating, error banner, navigation, submit, and the MitID step-up
round-trip), while each *flow* contributes only its content (its model, schema,
ordered steps, and backend fixture). The engine never interprets a field — it
orchestrates flow-supplied components but knows nothing about their internals. That
boundary is what keeps the standard composable without becoming a rigid framework
that "dev 31" has to fight.

All flow design follows the existing `multi-step-form` experiment:
`intro → n steps → tos → completed`, with deferred per-step error gates.

## Goals

- A reusable engine + contract that makes a new flow cost a small, mostly-declarative
  amount of code (model + schema + step components + a `FlowDef` + a fixture), with
  **zero orchestration code per flow**.
- Three flows that prove the abstraction by exercising distinct dimensions:
  minimal, complex fields, and in-context (MitID) signing.
- Signal forms (`@angular/forms/signals`) as the core. No NgRx, no state-management
  magic. State is signals + the form tree.
- Faithful simulation of a real backend contract: one GET for options, one POST to
  submit, with realistic HTTP status semantics including a 202 "signing required"
  step-up.
- Demonstrably balanced: low lines-of-code per flow **without** over-standardizing —
  steps are ordinary Angular components, schemas are hand-written, and a flow can add
  conditional logic or custom server-error handling without the engine changing.

## Non-goals (YAGNI)

- No real HTTP, no real auth, no real MitID — the backend and identity provider are
  simulated. The `mock-idp` app exists to make the *redirect round-trip* real, not the
  cryptography.
- No generated forms / no field-type registry. Fields are real components and real
  signal-forms schemas. (This is the deliberate rejection of the "pure config" approach.)
- No persistence beyond what the MitID round-trip requires (a single sessionStorage
  snapshot). No autosave/draft system.
- No host shell restructuring beyond the sanctioned extension points (one `EXPERIMENTS`
  entry) plus the `mock-idp` app the cross-origin redirect requires.

## Architecture overview

```
apps/tommy/host                 existing host — one new EXPERIMENTS entry, otherwise untouched
apps/tommy/mock-idp             NEW tiny Angular app: the cross-origin MitID stand-in (Approve/Cancel)

libs/tommy/signal-forms/flow-forge
  engine/      the shared skeleton (write once)
  ui/          shared presentational components + the .ui-* design layer
  steps/       shared reusable steps (e.g. the TOS step)
  flows/       newsletter | insurance | bank   (write per flow: content only)
  flow-registry.ts             the in-lib list of FlowDefs (mirror of host's EXPERIMENTS)
  flow-forge.ts                the launcher: gallery + <flow-runner> + MitID callback handling
```

The host derives one lazy route → the `FlowForge` launcher. The launcher shows a
flow gallery; selecting a flow renders the engine's `<flow-runner [def]>`. Flow
selection is signal-driven (no Angular child router), so the host shell is unchanged.
The MitID callback returns to the launcher route as query params, which the router
already forwards to the lazy component.

## The contract — `FlowDef`

One interface is the entire public API a flow author writes against. Because the
backend calls are shared (see below) and MitID is a submit outcome (not a step),
`FlowDef` is almost pure content:

```ts
interface FlowDef<Model, Features> {
  readonly meta: {
    slug: string;       // 'bank' — identifies the flow to the shared backend + callback URL
    title: string;      // 'Open a bank account'
    blurb: string;      // gallery card one-liner
    intro: string;      // intro-page copy
    dimension: 'minimal' | 'complex' | 'signing';  // gallery badge
  };
  buildForm(env: FlowEnvelope<Features>, injector: Injector): FlowForm<Model>;  // signal forms
  readonly steps: readonly StepDef<Model, Features>[];   // ordered; the last step submits
  toSubmission(model: Model): unknown;                   // model → POST payload
  mapServerError?(                                        // optional: place a 422 field error
    err: ServerFieldError,
    form: FieldTree<Model>,
  ): { stepKey: string; node: FieldTree<unknown> };
}
```

Supporting types:

```ts
interface FlowEnvelope<Features> {     // the backend's GET response — "features + terms"
  readonly features: Features;          // per-flow typed bag of constraints/config
  readonly terms: readonly TermItem[];  // the TOS list (shared shape)
}

interface TermItem { readonly id: string; readonly title: string; readonly body: string; readonly required: boolean; }

interface StepDef<Model, Features> {
  readonly key: string;                                   // gate key + step identity
  readonly label: string;                                 // step indicator
  readonly component: Type<unknown>;                       // an ordinary Angular component
  field(form: FieldTree<Model>): FieldTree<unknown>;       // which slice this step validates/gates
  inputs?(env: FlowEnvelope<Features>, form: FieldTree<Model>): Record<string, unknown>; // extra @Inputs
}

interface FlowForm<Model> { readonly model: WritableSignal<Model>; readonly form: FieldTree<Model>; }
```

`features` is typed per flow (`NewsletterFeatures`, `InsuranceFeatures`,
`BankFeatures`). The engine handles the `FlowEnvelope` envelope generically; the flow
keeps full type-safety on its own constraints. This is the backend flexibility
element: a typed-per-flow `features` bag rather than a `Record<string, unknown>`
free-for-all.

The registry erases generics to `FlowDef<unknown, unknown>` for storage; a single
cast at the registry boundary is acceptable for a simulated backend.

## Shared backend service

Every flow calls the same GET (options) and the same POST (submit), differing only by
`slug` and data. So there is **one** injectable service, not one per flow:

```ts
@Injectable({ providedIn: 'root' })
class FlowBackend {
  loadOptions(slug: string): Promise<FlowEnvelope<unknown>>;                 // GET /flows/:slug/options
  submit(slug: string, payload: unknown, signature?: Signature): Promise<SubmitOutcome>; // POST /flows/:slug
}
interface Signature { readonly challengeId: string; readonly token: string; }
```

The service is generic; per-flow *data* lives with the flow as a fixture, registered
into a `FLOW_FIXTURES` map keyed by slug that the backend reads:

```ts
// flows/<flow>/fixtures.ts contributes:
interface FlowFixture<Features> {
  readonly features: Features;
  readonly terms: readonly TermItem[];
  submit(payload: unknown, signature?: Signature): SubmitOutcome;  // the flow's submit rules
}
```

This shares the service logic while keeping flow-specific data co-located with the
flow. Promises (not Observables) match the existing flow's `await submit(...)` usage
and signal forms' async `submit()` action. A shared `delay()` helper simulates
latency.

### Submit outcome and HTTP status semantics

The simulated responses use realistic status codes:

```ts
type SubmitOutcome =
  | { status: 'ok';               httpStatus: 200; confirmationId: string }
  | { status: 'signing_required'; httpStatus: 202; signingUrl: string; challengeId: string }
  | { status: 'rejected';         httpStatus: 422; errors: readonly ServerFieldError[] };

interface ServerFieldError { readonly field: string; readonly message: string; }
```

- **200 OK** — submission completed; carries a `confirmationId`.
- **202 Accepted** — chosen status for "MitID signature required". Per RFC 7231 §6.3.3,
  202 means the request was accepted for processing but is not complete because another
  process must act — an exact fit for an out-of-band step-up. Re-submitting with the
  signature completes it (→ 200).
- **422 Unprocessable Entity** — semantic validation failure; carries field errors.
  Generalizes today's hard-coded "username taken" path.

## The engine

### `createWizard()` — headless controller

A pure-signals controller, lifted from today's `multi-step-flow.ts` and made
step-key-generic. It owns:

- `phase: 'intro' | 'form' | 'done'`, `stepIndex`, derived `currentStep`,
  `isFirst`, `isLast`.
- The per-step **gate**: `Record<stepKey, readonly string[] | null>` with the existing
  frozen-snapshot semantics — `null` = not validated, `[]` = validated clean,
  `[...]` = a frozen banner snapshot that only a Next/Submit press rewrites.
- `validateStep()` / `snapshotMessages()` / `setGate()` — ported verbatim in behavior,
  generalized from the hard-coded `profile|account|tos` keys to `step.key`.
- `next()` / `back()` navigation (back from the first step returns to intro).

This is unit-testable without a DOM — the highest-value tests live here.

### `<flow-runner [def]>` — the engine component

Renders the chrome and drives the async edges. It is flow-agnostic:

- Phase chrome (intro/done) rendered from `def.meta` via a `flow-shell`.
- The step indicator (from `def.steps[].label`) and the error banner (from the gate).
- The active step rendered via **`NgComponentOutlet`** with
  `[ngComponentOutletInputs]`, binding `field` (the slice from `step.field(form)`),
  `showErrors` (the gate's `attempted` state), plus whatever `step.inputs?()` returns
  (e.g. the TOS step receives `terms`).
- Async edges: `loadOptions(slug)` → `buildForm`; submit coordination (below);
  persist/restore for the MitID round-trip.
- The flow author writes no orchestration code — only `FlowDef` + components + schema +
  fixture.

### Submit coordination (the Angular way)

```
submit():
  payload = def.toSubmission(model)
  outcome = await backend.submit(slug, payload)              // first attempt, no signature
  ok               → phase = 'done'
  rejected (422)   → for each error: (def.mapServerError ?? default)(err) → place + reset subtree,
                     freeze that step's banner, navigate to that step       (today's server-error path)
  signing_required → store {slug, model, challengeId} ; redirect.to(signingUrl + returnUrl)  // full unload
```

Idiomatic Angular throughout: injectable seams (`ExternalRedirect`, `FlowStateStore`),
signal state, `ActivatedRoute` query params for the callback (no hand-parsing of
`window.location`).

## MitID step-up — the cross-origin round-trip

MitID is **not** a step. It is a branch of the submit pathway, triggered entirely by
the backend's 202 response. The bank flow's *fixture* demands signing; the engine
handles it uniformly. Any flow could trigger it; no flow contains MitID code.

```
1. User completes all steps + TOS → Submit.
2. backend.submit('bank', payload)  →  202 { signingUrl, challengeId }
3. Engine snapshots { slug, model, challengeId } to sessionStorage (versioned key —
   a schema-version bump invalidates stale snapshots), then:
   ExternalRedirect.to(signingUrl + '&return=' + <host>/flow-forge?mitid=callback&flow=bank)
   → real full-page unload; SPA state destroyed.
4. mock-idp (separate origin) renders Approve / Cancel, then redirects back to the
   host callback URL with status + token.
5. Fresh app boot. The FlowForge launcher reads ActivatedRoute.queryParamMap:
     ?mitid=callback&flow=bank&status=approved&challenge=…&token=…
        → restore snapshot → rebuild form via def.buildForm → re-submit WITH signature
              200 → phase = 'done'
              422 → land on TOS step + error banner
     ?mitid=callback&status=cancelled
        → restore → select flow → land on TOS step + "Signing cancelled" banner
   In all cases: clear the snapshot afterwards.
```

### Seams and persistence

- **`ExternalRedirect`** — injectable wrapper over `window.location.href =`. Specs
  substitute a fake so tests never actually navigate (and zoneless stays happy).
- **`FlowStateStore`** — injectable serialize/restore over `sessionStorage`. Stores
  `{ flowSlug, version, model, challengeId }`. The model is a plain serializable object
  (it backs `signal<Model>`), so JSON round-trips; the `FieldTree` is rebuilt from the
  model via `buildForm` on return. Versioned so a stale snapshot from an older schema
  is discarded rather than rehydrated incorrectly. Unit-tested independently.

### The `mock-idp` app

A minimal standalone Angular app (`apps/tommy/mock-idp`), served on its own port/origin
in dev (cross-origin realism). It reads the `return`, `challenge`, and a flow label
from the query, renders a MitID-styled Approve / Cancel screen, and on action redirects
to `return` with `status` (`approved`/`cancelled`) and a `token`. No host code is
involved in the provider UI.

## The three flows

```
flows/newsletter/   MINIMAL    intro → contact → prefs → tos → done
                               text/email/radio/checkbox only — the low-LOC proof
flows/insurance/    COMPLEX    intro → policy → incident → items[] → tos → done
                               dynamic array (add/remove items), conditional reveal
                               (injured? → injury fields), cross-field (claim ≤ coverage from features)
flows/bank/         SIGNING    intro → applicant → account-type → tos → done
                               ordinary steps; the 202 step-up happens at submit
```

- **Newsletter (minimal):** the cost floor. A small model, a tiny schema, two trivial
  step components, a `FlowDef`, a fixture. Proves a new flow is cheap.
- **Insurance (complex fields):** exercises every "complex field" pattern — a dynamic
  array via `applyEach` with add/remove UI, conditional fields revealed by a sibling
  value (schema `validate` conditioned on the sibling + conditional template render),
  and cross-field validation reading `features` (e.g. claimed amount ≤ policy coverage).
- **Bank (in-context signing):** ordinary-looking steps; its fixture returns 202 on
  submit, driving the engine's MitID round-trip. Distinguishing dimension is the
  post-submit step-up, performed by the engine, not the flow.

The **TOS step is a shared reusable step** (`steps/tos-step.ts` bound to `terms`)
dropped into all three — reuse demonstrated. `intro` and `done` are engine-rendered
from `meta`.

## Host integration

- Add **one** entry to `apps/tommy/host/src/app/experiments/registry.ts`
  (`slug: 'flow-forge'`, lazy `load` → `FlowForge`), plus the `@tommy/signal-forms/flow-forge`
  path alias in `tsconfig.base.json`. This is the same per-experiment extension every
  experiment uses; the host shell is otherwise untouched.
- The `FlowForge` launcher holds the in-lib `flow-registry.ts`, renders a creative flow
  gallery (cards with title, blurb, dimension badge), and on selection renders
  `<flow-runner [def]>`. Selection is signal-driven; the MitID callback arrives as
  query params the launcher reads via `ActivatedRoute`.

## File structure

```
libs/tommy/signal-forms/flow-forge/src/
  index.ts                      → exports FlowForge
  lib/
    engine/
      flow-def.ts               → FlowDef, StepDef, FlowEnvelope, TermItem, SubmitOutcome, ServerFieldError, Signature
      wizard.ts                 → createWizard() headless controller (phase/stepIndex/gate/nav)
      flow-runner.ts            → <flow-runner [def]> engine component (render + submit coordination)
      flow-backend.ts           → shared FlowBackend service + FLOW_FIXTURES registry
      flow-state-store.ts       → sessionStorage persist/restore (versioned)
      external-redirect.ts      → injectable window.location seam
      mitid.ts                  → return-url contract + mock-idp url builder + callback parsing
    ui/
      flow-shell.ts             → card/intro/done frame
      step-indicator.ts  error-banner.ts  field-error.ts   → ported from multi-step-form
      ui.css                    → the .ui-* design layer (ported)
    steps/
      tos-step.ts               → shared reusable TOS step
    flows/
      newsletter/  def.ts  model.ts  schema.ts  fixtures.ts  steps/*
      insurance/   def.ts  model.ts  schema.ts  fixtures.ts  steps/*
      bank/        def.ts  model.ts  schema.ts  fixtures.ts  steps/*
    flow-registry.ts            → [newsletterFlow, insuranceFlow, bankFlow]
    flow-forge.ts               → launcher (gallery + runner + callback)
apps/tommy/mock-idp/            → minimal Approve/Cancel app (own serve target/port)
```

## UI / design layer

- Reuse the hand-authored `.ui-*` `ui.css` design layer (ported from `multi-step-form`),
  so all visual styling lives in one swappable file and matches the existing flows.
- Add **Angular CDK** for headless, zoneless-friendly a11y primitives:
  `LiveAnnouncer` for the error banner, and focus management on step change (via
  `afterNextRender`, since the host is zoneless and the render tick is a macrotask).
  Optionally CDK Stepper semantics for the step indicator. No opinionated styling, no
  state-management magic — signal forms remain the core.

## Testing & verification

- **Engine:** `createWizard` gate/nav transitions (incl. frozen-snapshot behavior);
  `flow-state-store` round-trip + version invalidation; `flow-runner` DOM happy path and
  the 422 server-error path (ports the existing `multi-step-flow.spec.ts`).
- **MitID:** with the `ExternalRedirect` seam, assert: submit → 202 → snapshot stored →
  redirect invoked; and simulated callback boot (`approved`) → re-submit with signature →
  `done`; (`cancelled`) → TOS + banner. No real navigation in tests.
- **Per flow:** schema validation specs and a DOM smoke test. Insurance additionally:
  array add/remove, conditional reveal, cross-field rule. Bank: its fixture returns 202.
- **mock-idp:** a light spec for Approve/Cancel building the correct return URL.
- **AOT/templates:** run `pnpm nx build tommy-host` for the real `strictTemplates` check
  (notably `NgComponentOutlet` inputs typing) — the lib `typecheck` is plain tsc and
  misses templates.
- **README:** update the root experiments table (+ Flow Forge row), document running
  both apps (`nx serve tommy-host` + `nx serve mock-idp`) and the Vercel implication
  (the redirect needs a deployed `mock-idp` origin or degrades gracefully when absent),
  and add a lib README.

## Success metric — the balance proof

The implementation will record **lines of code per flow** as an explicit outcome:
newsletter the smallest, insurance the largest, and **none** containing orchestration
code. Counter-evidence against over-standardization: schemas are hand-written signal
forms (not generated), steps are free components, and a flow can add conditional logic,
a custom `mapServerError`, or trigger the 202 step-up purely via its fixture — none of
which require the engine to change. The escape hatch for an unforeseen flow 31: a step
is just a component; drop to bespoke without leaving the standard.

## Risks / open considerations

- **mock-idp serve & deploy.** Dev requires two serve targets; document a combined
  command. The Vercel deployment needs a `mock-idp` origin, or the bank flow must
  degrade gracefully (a clear "MitID provider unavailable" state) when the origin is
  absent. Implementation should not hard-fail without it.
- **Cross-origin return.** The return URL must be absolute and origin-correct in both
  dev and prod; centralize URL construction in `mitid.ts`.
- **`NgComponentOutlet` input typing.** Inputs are bound as a `Record<string, unknown>`;
  rely on the AOT build for template type safety and keep step `@Input` names stable.
- **Snapshot versioning.** Bump the stored `version` whenever a model shape changes so a
  stale sessionStorage snapshot is discarded rather than rehydrated incorrectly.
