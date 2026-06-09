# Flow Compose (Flow Forge v2) — Design

**Date:** 2026-06-09
**Status:** Approved (pending written-spec review)
**Supersedes (architecturally, not physically):** `@tommy/signal-forms/flow-forge`

## Summary

Flow Forge treats a flow as **data interpreted by an engine** (`FlowDef` with a
`steps: StepDef[]` array the runner walks, binding each step component through
`NgComponentOutlet`). Flow Compose reframes a flow as **a template that composes
engine parts** — the signal-forms analogue of the Material/CDK stepper shape
(`<mat-stepper><mat-step>…`). Steps become `<ng-template flowStep>` content the
runner *queries* instead of an array it *interprets*.

The payoff is type safety: every step input binding moves into the flow's own
template, where `strictTemplates` checks it against the real component inputs — no
erased generics, no unchecked `NgComponentOutlet` inputs. The cost is per-flow
declarative repetition (a template skeleton + a ~10-line load/form block per flow);
the Angular-blessed answer to that (a generator) is deferred, documented, not built.

This redesign is **strictly better-typed than Flow Forge** — conceded out loud in
the README, because moving isn't capitulation; there's an engineering reason. What
it trades away is the interpreter's *runtime* guarantee that a flow cannot deviate,
for a *conventional* guarantee that a flow doesn't (by construction + review).

## Decisions (locked)

| Question | Decision |
| --- | --- |
| Relationship to v1 | **New sibling lib.** v1 stays intact + tested for a live A/B of the two architectures. |
| Launcher rendering | **Static `@switch`** over the selected slug. No registry, no cast, fully `strictTemplates`-checked. |
| Conditional steps | **Load-time only.** Wizard captures the settled step set on entering the form phase; mid-flow insertion is documented out of scope. |
| Nx generator | **Deferred** to future work (documented in README). |

## Library shape & layout

- **Project:** `libs/tommy/signal-forms/flow-compose`
  - Nx name `tommy-signal-forms-flow-compose`, alias `@tommy/signal-forms/flow-compose`,
    tag `scope:tommy` (per the `tommy-test-convention`). Generated via the `nx-generate`
    skill (`@nx/angular:library`, matching v1's config: vite/vitest, OnPush, zoneless host).
  - Name alternative considered: `flow-forge-v2`. `flow-compose` chosen for the
    "compose engine parts" framing.
- **Self-contained — copied verbatim from v1** (no cross-lib import; v1 is never
  touched, honoring "keep it intact"):
  - Engine primitives that transfer unchanged: `wizard.ts`, `flow-backend.ts`,
    `flow-state-store.ts`, `mitid.ts`, `schema-helpers.ts`, `external-redirect.ts`
    (and their specs).
  - All `ui/*`: `flow-shell`, `step-indicator`, `error-banner`, `field-error`, `ui.css`.
  - Per-flow `model.ts` / `schema.ts` / `fixtures.ts` and their specs (with the small
    refactors below).
- **The honest cost:** the unchanged engine primitives are **duplicated** across the
  two libs. Deliberate — extracting a shared `flow-core` would require modifying v1.
  "Extract shared core" is documented as future work next to the generator.

## The new contract surface

Three constructs replace `StepDef` / `defineStep()` / `StepComponent` and
`FlowDef.buildForm` / `FlowDef.steps`.

### (a) `FlowStep` structural directive

The field slice **is** the directive's main input; an `ngTemplateContextGuard`
reflects its element type back into the template context so the flow author's
`let-field` is strongly typed.

```ts
export interface FlowStepContext<S> {
  $implicit: FieldTree<S>;
  showErrors: boolean;
}

@Directive({ selector: 'ng-template[flowStep]' })
export class FlowStep<S> {
  readonly field = input.required<FieldTree<S>>({ alias: 'flowStep' });
  readonly key   = input.required<string>({ alias: 'flowStepKey' });
  readonly label = input.required<string>({ alias: 'flowStepLabel' });
  readonly template = inject<TemplateRef<FlowStepContext<S>>>(TemplateRef);

  static ngTemplateContextGuard<S>(_d: FlowStep<S>, ctx: unknown): ctx is FlowStepContext<S> {
    return true;
  }
}
```

The slice doubles as the input because the runner needs it anyway: `validateStep()`
runs the gate against exactly that subtree (what `StepDef.field(form)` did in v1).

### (b) `FlowConfig<Model>` (replaces `FlowDef`)

`FlowDef` minus every member the engine interpreted (`buildForm`, `steps`). Pure
data. `snapshot`/`restore` ride along — each consumed by the right party (see Resume).

```ts
interface FlowConfig<Model> {
  readonly meta: FlowMeta;            // slug, title, blurb, intro, dimension
  readonly schemaVersion: number;
  toSubmission(model: Model): unknown;
  mapServerError?(e: ServerFieldError, form: FieldTree<Model>):
    { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;   // runner reads on 202 signing_required
  restore?(raw: unknown): Model;       // flow component reads on resume
}
```

Retained unchanged from v1's `flow-def.ts`: `FlowMeta`, the `{ features, terms }`
envelope types (`FeatureMap`/`FeatureDescriptor`/`TermsMap`/`TermDescriptor`/
`FlowEnvelope`), `ServerFieldError`, `Signature`, and the `SubmitOutcome` union.

### (c) `FlowRunner` shrinks to a shell

```ts
@Component({ selector: 'tommy-flow-runner', imports: [NgTemplateOutlet, FlowShell, StepIndicator, ErrorBanner], ... })
export class FlowRunner {
  readonly config = input.required<FlowConfig<unknown>>();
  readonly form   = input.required<FieldTree<unknown>>();   // always defined: author guards on @if (form())
  readonly resume = input<Signature | null>(null);
  private readonly steps = contentChildren(FlowStep);        // Signal<readonly FlowStep<unknown>[]>
  // …keeps createWizard, the gate, indicator, banner, submit() machine, 202/422 handling…
}
```

- Renders the active step via `ngTemplateOutlet` with context
  `{ $implicit: step.field(), showErrors: wizard.attempted() }`.
- The submit state machine (`onSubmit` → `submit(form, { action })` →
  200/202/422), `placeRejection`, `beginSigning`, and the `adaptState` gate adapter
  all port over **unchanged in behavior** — only their inputs change (read `config`/
  `form()` instead of `def()`/`flowForm()`).
- **One structural change:** `phase` (`intro | form | done`) **lifts out of the
  wizard onto the runner.** The intro chrome must render without forcing the wizard
  to build, because the wizard can only capture its step set *after* conditional
  steps settle (see Conditional steps). The wizard is built lazily, once, on the
  first transition into the `form` phase.

### Deleted by v2

`StepDef`, `defineStep()`, `StepComponent`, the per-step contract checks,
`FlowDef.buildForm`, `FlowDef.steps`, `AnyFlowDef`, the `FLOWS as AnyFlowDef`
registry cast, `NgComponentOutlet`, the `stepInputs()` builder + the optional-`data`
binding dance, and the entire "unchecked dynamic-component inputs" risk class.

## The per-flow component (the composable cost)

Each flow owns its data load + form and declares its steps as visible, ordered
content. Example (bank, the signing flow):

```ts
@Component({
  selector: 'bank-flow',
  imports: [FlowRunner, FlowStep, ApplicantStep, AccountTypeStep, TosStep],
  templateUrl: './bank-flow.html',
})
export class BankFlow {
  private readonly backend = inject(FlowBackend);
  private readonly resume  = inject(FlowResume);
  private readonly pending = this.resume.pending('bank');       // { model, signature } | null

  protected readonly config = BANK_FLOW_CONFIG;                  // pure data
  protected readonly env    = resource({ loader: () => this.backend.loadOptions('bank') });
  protected readonly model  = signal<BankModel>(
    this.pending ? (BANK_FLOW_CONFIG.restore?.(this.pending.model) ?? this.pending.model as BankModel)
                 : emptyBankSkeleton());
  protected readonly form   = computed(() =>
    this.env.hasValue() ? bankForm(this.model, this.env.value()!) : undefined);
  protected readonly signature = this.pending?.signature ?? null;

  constructor() {
    // Seed env-derived defaults (only the tos[] array) once env resolves — but NOT
    // when resuming (the restored model already carries the user's tos answers).
    // (`resource().value()` is typed `T | undefined` even after `hasValue()`, so the
    // non-null assertion is required — TS does not narrow the method's result.)
    effect(() => {
      if (this.pending || !this.env.hasValue()) return;
      this.model.update((m) => ({ ...m, tos: tosAcksFrom(this.env.value()!.terms) }));
    });
  }
}
```

```html
@if (form(); as form) {
  <flow-runner [config]="config" [form]="form" [resume]="signature">
    <ng-template [flowStep]="form.applicant" flowStepKey="applicant" flowStepLabel="Applicant"
                 let-field let-showErrors="showErrors">
      <tommy-bank-applicant-step [field]="field" [showErrors]="showErrors" />
    </ng-template>

    <ng-template [flowStep]="form.account" flowStepKey="account" flowStepLabel="Account"
                 let-field let-showErrors="showErrors">
      <tommy-bank-account-type-step [field]="field" [showErrors]="showErrors" />
    </ng-template>

    <ng-template [flowStep]="form.tos" flowStepKey="tos" flowStepLabel="Terms"
                 let-field let-showErrors="showErrors">
      <tommy-tos-step [field]="field" [terms]="env.value()!.terms" [showErrors]="showErrors" />
    </ng-template>
  </flow-runner>
} @else if (env.error()) {
  <!-- retry chrome -->
} @else {
  <!-- loading chrome -->
}
```

Every binding sits in the flow's own template → `strictTemplates` checks
`field` / `terms` / `showErrors` against the real component inputs. Full AOT, zero
erased generics at the seam.

### Per-flow refactors (small, mechanical)

1. **`emptyModel(env)` splits** into an env-free skeleton (`emptyBankSkeleton()`,
   `tos: []`) + the env-seeding effect above. The *only* env-derived field in any of
   the three models is `tos: tosAcksFrom(env.terms)`; everything else is constant.
   (Signal-forms reactivity means even if the form builds before the effect seeds,
   the `tos` field array updates when `model.tos` does — and the tos step is always
   the last step, long after env resolves.)
2. **`TosStep` loses its `data` input.** `readonly data = input.required<TermsMap>()`
   → `readonly terms = input.required<TermsMap>()`; template `@let terms = data()` →
   `terms()`; drop `implements StepComponent`. Bound directly in each flow template
   as `[terms]="env.value().terms"`.
3. **Step components drop `implements StepComponent<…>`** and the
   `import … StepComponent` line. They keep their `field` + `showErrors` inputs
   verbatim (those bindings are now strictTemplates-checked at the call site).
4. **`buildForm` becomes a free function per flow** (e.g. `bankForm(model, env)`)
   that the flow component calls inside its `form` computed. It still wraps
   `form(model, schema(env))` in `runInInjectionContext` — note `computed` runs in an
   injection context already, so the explicit `injector` plumbing from v1's
   `buildForm(env, injector)` is no longer needed; `inject(Injector)` (or just
   relying on the computed's context) suffices. Confirm during implementation.

## The MitID resume seam (`FlowResume`)

The single deliberate seam the redesign adds. In v1 the runner did the whole
round-trip imperatively (`resumeAndSubmit`). In v2 the work splits across two owners
(flow restores the model, runner re-submits the signature), but the snapshot is
**single-use** (`store.restore` removes it from `sessionStorage`), so one in-memory
reader fronts it.

### `FlowResume` service (`providedIn: 'root'`)

- `consume(queryParamMap): string | null` — called **once** by the launcher on boot.
  The *only* `parseCallback` caller and the *only* `store.restore` reader. Parses the
  callback; validates the `state` nonce against the single-use snapshot. On valid
  `approved`: caches `{ slug, model, signature: { challengeId, code } }` in memory,
  returns the slug. On valid `cancelled`: caches a cancelled marker, returns the slug.
  On replay/mismatch/no-callback: returns `null`. The security shape (single-use,
  origin check via `isSameOrigin`, version gate) transfers unchanged — just relocated
  from the launcher into this service.
- `pending(slug): { model: unknown; signature: Signature } | null` — in-memory,
  **multi-read** (the single-use risk lived in `sessionStorage`; once validated into
  memory it is just app state). Both readers below call it freely.
- `cancelledNotice(slug): boolean` — drives the launcher's "Signing cancelled — you
  can review and resubmit" banner.

### Two readers, cleanly divided

- **Flow component** calls `pending(slug)` to **seed the restored model** into its
  initial `model` signal (applying `config.restore`). The form is built already
  populated — no post-build mutation, no ordering race.
- **Runner** receives that pending's `signature` via `[resume]` and **re-submits**:
  an effect, guarded to fire once, waits until `form` is present and `steps()` is
  populated, then jumps the wizard to the last step and calls `submit(signature)` →
  200 → `done`. (Re-fetching options is unnecessary now — the flow component's
  `resource` already loaded them; v1 re-fetched only because the runner owned the
  load.)

Because the model is restored into the *initial* signal and the form is built from
it, "restore model" strictly precedes "re-submit" by construction.

## Launcher (`@switch`) + load-time conditional steps

### Gallery

The launcher keeps the card grid. Selection sets a `slug` signal; rendering is static:

```html
@switch (selected()) {
  @case ('newsletter') { <newsletter-flow /> }
  @case ('bank')       { <bank-flow /> }
  @case ('insurance')  { <insurance-flow /> }
}
```

- Card metadata (`slug`/`title`/`blurb`/`dimension`) comes from a small `FLOW_CARDS`
  data array — pure presentation data for the gallery, not an engine registry.
- On boot the launcher calls `flowResume.consume(route.snapshot.queryParamMap)`; a
  returned slug auto-selects that flow and surfaces the cancelled notice (read from
  `FlowResume.cancelledNotice`).
- `FlowBackend` + `FLOW_FIXTURES` are still co-provided at the launcher (as in v1),
  visible to all flow components in the subtree.

### Load-time conditional steps (the honest "free")

The runner builds the wizard **lazily, once, on entering the `form` phase**, reading
`steps()` at that moment. By form-entry, env has resolved, so any
`@if (env…)`-wrapped `<ng-template flowStep>` has already settled into
`contentChildren`. The wizard captures that settled set; `stepIndex` indexes
`steps()` in declared order, so the wizard's captured order and the rendered order
stay aligned for the flow's lifetime.

Mid-flow insertion (a step appearing from a value typed in an earlier step) is
explicitly **out of scope** — that is precisely why `phase` lifts onto the runner, so
the intro chrome never builds the wizard before steps settle. None of the three
current flows have conditional steps, so this is **preserved-and-documented, not
demoed**.

## Testing strategy

- **Test host replaces the test flow.** The runner can no longer be driven by
  `setInput('def', …)` — it needs projected `<ng-template flowStep>`. So
  `testing/test-flow.ts` becomes `testing/test-host.ts`: a tiny host declaring
  `<flow-runner [config] [form] [resume]>` with two steps (`#t-name`, `#t-city`).
- **Ported runner specs.** Every current `flow-runner.spec` behavior re-expresses
  through that host: intro renders from meta, Start→first step, Next/Back, gate blocks
  empty step, submit 200→done, 422→banner, 202→snapshot+same-origin redirect, and
  resume→done.
- **Ported round-trip spec.** `flows/bank/round-trip.spec` re-expresses on the v2
  shape: `FlowResume` (seeded from a faked single-use snapshot) + `<bank-flow>` +
  runner, with `ExternalRedirect`/`FlowStateStore` seams faked. Still asserts the
  exact round-trip confirmation id (challengeId survives the trip).
- **New specs.** `FlowStep` (context guard + input aliases resolve), `FlowResume`
  (single-read, state validation, cancelled marker, replay rejection).
- **Copied unchanged.** `wizard.spec`, `flow-backend.spec`, `flow-state-store.spec`,
  `mitid.spec`, `schema-helpers.spec`, and each flow's `schema.spec` / `fixtures.spec`.
- **AOT/template check.** Per `nx-aot-template-check`: the lib's `typecheck` is plain
  tsc and misses templates. A real `strictTemplates`/NG8022 check requires an app
  build. Either wire a host route that renders a flow and `pnpm nx build tommy-host`,
  or add a build target to the lib. Decide during planning. This is the gate that
  proves the central type-safety claim, so it must run.

## The ledger (for the README)

**Gained (conceded out loud):** v2 is strictly better-typed than Flow Forge. Deleted:
`StepDef`, `defineStep()`, per-step contract tests, the registry cast, `NgComponentOutlet`
+ unchecked inputs, and the whole Risks-#1 class. Full AOT coverage, zero erased
generics, a shape any Angular dev pattern-matches to the CDK stepper in five seconds.

**Lost:** Nicholas's *runtime* guarantee — an interpreter *cannot* let a flow deviate;
composition *conventionally doesn't*. Each flow now carries ~40–70 lines of declarative
repetition (template skeleton + load/form block).

**The answer to the repetition (deferred, documented):**
1. An Nx generator (`nx g …:flow <name>`) that stamps the canonical component,
   template, schema, model, and fixture — moving consistency enforcement from runtime
   (engine interprets) to creation time (generator stamps), with review guarding
   changes. Given review is the team bottleneck, that is the argument to make.
2. A shared `flow-core` extraction that de-dupes the engine primitives copied from
   v1, once v1 can be retired.

## Out of scope

- The Nx generator (documented as the headline future work).
- Shared `flow-core` extraction (depends on retiring v1).
- Mid-flow dynamic step insertion (only load-time conditionals supported).
- Any change to v1 (`flow-forge`) — it stays frozen for the comparison.
