# Flow Forge — Engine, Host Gallery & Newsletter Flow (Plan 1 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the reusable Flow Forge engine (the standardized "skeleton") plus a host flow-gallery launcher and the minimal "newsletter" flow, proving the hybrid abstraction end-to-end.

**Architecture:** A headless wizard controller + a generic `<flow-runner>` engine component own all orchestration (phase machine, per-step validity gate, error banner, navigation, submission via signal-forms `submit()`, and the 202/MitID persist-and-resume plumbing). Each *flow* contributes only content: a model, a signal-forms schema, ordinary step components, a backend fixture, and a `FlowDef`. A shared `FlowBackend` service serves one GET (options) and one POST (submit) keyed by flow slug. The `features`/`terms` backend envelope is a keyed map of descriptors sharing a common base. Plan 2 adds the insurance + bank flows and the cross-origin `mock-idp` app; this plan builds the complete engine (the 202 step-up branch is implemented and tested here via a synthetic fixture, then exercised for real in Plan 2).

**Tech Stack:** Angular 21.2.x (zoneless), `@angular/forms/signals` (experimental signal forms), `@angular/cdk` (a11y), Nx 22.7.5, Vitest (`vitest-analog`), Tailwind v4 (`.ui-*` plain-CSS design layer), pnpm 10.

**Spec:** `docs/superpowers/specs/2026-06-07-flow-forge-complex-multi-step-design.md`

**Reference implementation to adapt:** the existing `libs/tommy/signal-forms/multi-step-form/` already does signal-forms `submit()` with server errors, the frozen-snapshot gate, and the `.ui-*` UI components. Several tasks port/generalize that proven code — exact files and line ranges are cited.

---

## File Structure

```
libs/tommy/signal-forms/flow-forge/
  project.json, vite.config.mts, tsconfig*.json, eslint.config.mjs   (generated)
  src/
    index.ts                          → exports FlowForge (launcher entry)
    test-setup.ts                     (generated)
    lib/
      engine/
        flow-def.ts                   → FlowDef, StepDef, StepComponent, defineStep, FlowEnvelope,
                                         FeatureDescriptor/FeatureMap, TermDescriptor/TermsMap,
                                         SubmitOutcome, ServerFieldError, Signature, FlowForm
        schema-helpers.ts             → applyFeature() and friends (feature-aware schema helpers)
        wizard.ts                     → createWizard() headless controller (phase/stepIndex/gate/nav)
        external-redirect.ts          → injectable window.location seam
        flow-state-store.ts           → versioned, single-use sessionStorage snapshot store
        mitid.ts                      → return-url builder + same-origin check + callback parsing + state
        flow-backend.ts               → FlowBackend service + FLOW_FIXTURES registry + delay()
        flow-runner.ts                → <flow-runner [def]> engine component
      ui/
        ui.css                        → ported .ui-* design layer (+ flow-shell/gallery classes)
        field-error.ts                → ported (generic, unchanged)
        error-banner.ts               → ported (+ CDK LiveAnnouncer)
        step-indicator.ts             → ported (unchanged)
        flow-shell.ts                 → new: card + intro/done frame
      steps/
        tos-step.ts                   → shared reusable TOS step (used by newsletter; reused in Plan 2)
      flows/
        newsletter/
          model.ts                    → NewsletterModel + emptyModel(env)
          schema.ts                   → newsletterSchema(env)
          fixtures.ts                 → NewsletterFeatures + fixture (features/terms/submit)
          steps/contact-step.ts       → name + email
          steps/prefs-step.ts         → frequency (radio) + topics (checkboxes)
          def.ts                      → newsletterFlow: FlowDef
      flow-registry.ts                → FLOWS: readonly FlowDef[]  (newsletter only in Plan 1)
      flow-forge.ts                   → FlowForge launcher (gallery + <flow-runner> + MitID callback)

apps/tommy/host/
  src/app/experiments/registry.ts     → +1 EXPERIMENTS entry (modify)
  project.json                        → + ui.css in build.styles[] (modify)
  src/styles.css                      → + @source for flow-forge (modify)
tsconfig.base.json                    → + @tommy/signal-forms/flow-forge path (modify)
```

---

### Task 1: Scaffold the `flow-forge` library with a placeholder entry, wired into the host

**Goal:** A new Nx library `tommy-signal-forms-flow-forge` exporting a placeholder `FlowForge` standalone component, lazy-loaded by the host at `/flow-forge`, building cleanly.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/**` (via generator)
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts` (placeholder)
- Modify: `libs/tommy/signal-forms/flow-forge/src/index.ts`
- Modify: `tsconfig.base.json` (path alias)
- Modify: `apps/tommy/host/src/app/experiments/registry.ts` (one entry)

**Acceptance Criteria:**
- [ ] `pnpm nx build tommy-host` succeeds.
- [ ] The host route `/flow-forge` lazy-loads `FlowForge`.
- [ ] `libs/tommy/signal-forms/flow-forge/project.json` mirrors the multi-step-form project (tags `scope:tommy`, `type:experiment`; prefix `tommy`).

**Verify:** `pnpm nx build tommy-host` → build succeeds; `pnpm nx test tommy-signal-forms-flow-forge` → runs (0 or passing).

**Steps:**

- [ ] **Step 1: Scaffold the library via the nx-generate skill.**

Per `CLAUDE.md`, invoke the `nx-generate` skill FIRST (do not guess flags). The intent is the Angular library generator with the workspace defaults already set in `nx.json` (`@nx/angular:library`, `unitTestRunner: vitest-analog`, `linter: eslint`). Target generator invocation:

```bash
pnpm nx g @nx/angular:library flow-forge \
  --directory=libs/tommy/signal-forms/flow-forge \
  --standalone --prefix=tommy --tags=scope:tommy,type:experiment \
  --no-interactive
```

After generating, confirm `libs/tommy/signal-forms/flow-forge/project.json` matches `libs/tommy/signal-forms/multi-step-form/project.json` (name `tommy-signal-forms-flow-forge`, same tags/prefix). If the generator created a sample component/spec, delete the sample component files (keep `index.ts`, `test-setup.ts`, configs).

- [ ] **Step 2: Create the placeholder entry component.**

`libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'tommy-flow-forge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p>Flow Forge — coming online…</p>`,
})
export class FlowForge {}
```

- [ ] **Step 3: Export it from the library barrel.**

`libs/tommy/signal-forms/flow-forge/src/index.ts`:

```ts
export * from './lib/flow-forge';
```

- [ ] **Step 4: Add the TypeScript path alias.**

In `tsconfig.base.json`, add to `compilerOptions.paths` (alongside the existing two):

```json
"@tommy/signal-forms/flow-forge": [
  "./libs/tommy/signal-forms/flow-forge/src/index.ts"
]
```

- [ ] **Step 5: Register one experiment entry in the host.**

In `apps/tommy/host/src/app/experiments/registry.ts`, append to the `EXPERIMENTS` array:

```ts
  {
    slug: 'flow-forge',
    title: 'Flow Forge',
    description:
      'A composable engine for signal-forms multi-step flows: one skeleton, many flows (minimal, complex fields, MitID signing).',
    group: 'Signal Forms',
    tags: ['signals', 'multi-step', 'experimental'],
    sourcePath: 'libs/tommy/signal-forms/flow-forge',
    load: () =>
      import('@tommy/signal-forms/flow-forge').then((m) => m.FlowForge),
  },
```

- [ ] **Step 6: Verify build + route.**

Run: `pnpm nx build tommy-host`
Expected: build succeeds (the new lazy chunk for `flow-forge` is emitted).

- [ ] **Step 7: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge tsconfig.base.json apps/tommy/host/src/app/experiments/registry.ts
git commit -m "feat(flow-forge): scaffold library + host registry entry"
```

---

### Task 2: Port the `.ui-*` UI layer, add a `flow-shell`, and wire CDK

**Goal:** The shared presentational layer is available in the lib (design-consistent with multi-step-form), `@angular/cdk` is installed, and the host renders the lib's `ui.css`.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/ui/ui.css` (port)
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/ui/field-error.ts` (port)
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/ui/error-banner.ts` (port + CDK)
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/ui/step-indicator.ts` (port)
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/ui/flow-shell.ts` (new)
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/ui/error-banner.spec.ts`, `field-error.spec.ts` (port)
- Modify: `apps/tommy/host/project.json` (styles array)
- Modify: `apps/tommy/host/src/styles.css` (@source)
- Modify: `package.json` (add `@angular/cdk`)

**Acceptance Criteria:**
- [ ] `@angular/cdk` is a dependency at the same Angular version line (21.2.x).
- [ ] `ui.css` is added to the host `build` target `styles` array.
- [ ] Ported components pass their specs.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → ported specs pass; `pnpm nx build tommy-host` → succeeds.

**Steps:**

- [ ] **Step 1: Install Angular CDK (pinned to the Angular line).**

```bash
pnpm add @angular/cdk@21.2.9
```
Expected: `@angular/cdk` appears in `package.json` dependencies at `21.2.9` (match the other `@angular/*` deps).

- [ ] **Step 2: Port the design layer and the two simple components verbatim.**

Copy these existing files to the new lib unchanged (they are already generic — `field-error` is `FieldError<T>`, `step-indicator` takes `labels`/`activeIndex`):

```bash
cp libs/tommy/signal-forms/multi-step-form/src/lib/ui/ui.css            libs/tommy/signal-forms/flow-forge/src/lib/ui/ui.css
cp libs/tommy/signal-forms/multi-step-form/src/lib/ui/field-error.ts    libs/tommy/signal-forms/flow-forge/src/lib/ui/field-error.ts
cp libs/tommy/signal-forms/multi-step-form/src/lib/ui/field-error.spec.ts libs/tommy/signal-forms/flow-forge/src/lib/ui/field-error.spec.ts
cp libs/tommy/signal-forms/multi-step-form/src/lib/ui/step-indicator.ts libs/tommy/signal-forms/flow-forge/src/lib/ui/step-indicator.ts
```

These files have no lib-relative imports (only `@angular/core` and `@angular/forms/signals`), so they need no edits.

- [ ] **Step 3: Port the error banner and add a CDK `LiveAnnouncer`.**

Copy `error-banner.ts` and `error-banner.spec.ts`, then add an announcement so assistive tech reads the banner when it appears (zoneless-safe: announce in an `effect`).

`libs/tommy/signal-forms/flow-forge/src/lib/ui/error-banner.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
} from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Presentational summary of a step's validation errors. Renders nothing when the
 * list is empty; `role="alert"` plus a CDK LiveAnnouncer so assistive tech announces
 * it (it appears on a deliberate Next/Submit press, not on every keystroke).
 */
@Component({
  selector: 'tommy-error-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (messages().length) {
      <div class="ui-banner-warning" role="alert">
        <p class="ui-banner-title">
          <span aria-hidden="true">⚠</span> One or more fields have errors:
        </p>
        <ul class="ui-banner-list">
          @for (message of messages(); track $index) {
            <li>{{ message }}</li>
          }
        </ul>
      </div>
    }
  `,
})
export class ErrorBanner {
  private readonly announcer = inject(LiveAnnouncer);
  readonly messages = input.required<readonly string[]>();

  constructor() {
    effect(() => {
      const count = this.messages().length;
      if (count) {
        this.announcer.announce(
          `${count} field${count === 1 ? '' : 's'} need attention.`,
          'assertive',
        );
      }
    });
  }
}
```

Copy the spec and add `provideExperimentalZonelessChangeDetection` if the existing spec doesn't already set up a TestBed; the LiveAnnouncer is provided by `@angular/cdk/a11y` automatically. If the ported spec fails because `LiveAnnouncer` needs the DOM live region, that is fine in jsdom (it appends to `document.body`); no extra provider is required.

- [ ] **Step 4: Create the `flow-shell` frame.**

`libs/tommy/signal-forms/flow-forge/src/lib/ui/flow-shell.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * The outer card frame every flow renders inside. Pure layout: a `.ui-card`
 * with a vertical stack. Content (intro/steps/done) is projected by the runner.
 */
@Component({
  selector: 'tommy-flow-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<section class="ui-card ui-stack"><ng-content /></section>`,
})
export class FlowShell {}
```

- [ ] **Step 5: Register `ui.css` with the host build and add the Tailwind `@source`.**

In `apps/tommy/host/project.json`, add to `targets.build.options.styles` (after the multi-step entry):

```json
"libs/tommy/signal-forms/flow-forge/src/lib/ui/ui.css"
```

In `apps/tommy/host/src/styles.css`, add after the existing `@source` line:

```css
@source '../../../../libs/tommy/signal-forms/flow-forge';
```

- [ ] **Step 6: Verify.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `field-error` and `error-banner` specs PASS.
Run: `pnpm nx build tommy-host`
Expected: succeeds (two `ui.css` files now in the styles array; no duplicate-class build error — both define the same `.ui-*` names, which is acceptable as identical declarations, but if the production `anyComponentStyle` budget or a duplicate-symbol warning appears, that is expected and harmless).

- [ ] **Step 7: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/ui apps/tommy/host/project.json apps/tommy/host/src/styles.css package.json pnpm-lock.yaml
git commit -m "feat(flow-forge): port .ui-* layer, add flow-shell + CDK LiveAnnouncer"
```

---

### Task 3: Engine contract types + feature-aware schema helpers

**Goal:** The full `FlowDef` contract surface (`flow-def.ts`) and the shared `applyFeature` schema helpers (`schema-helpers.ts`) exist and are unit-tested.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-def.ts`
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/schema-helpers.ts`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/engine/schema-helpers.spec.ts`

**Acceptance Criteria:**
- [ ] `defineStep()` ties the `field` selector's slice type to the component's `Slice` at compile time.
- [ ] `applyFeature(node, descriptor)` applies `required` when `descriptor.mandatory` is true and skips it when false.
- [ ] `FlowEnvelope` defaults its `Features` generic to `FeatureMap`.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → `schema-helpers.spec.ts` passes.

**Steps:**

- [ ] **Step 1: Write the failing test for `applyFeature`.**

`libs/tommy/signal-forms/flow-forge/src/lib/engine/schema-helpers.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection, signal } from '@angular/core';
import { form, schema } from '@angular/forms/signals';
import { applyFeature } from './schema-helpers';
import type { FeatureDescriptor } from './flow-def';

interface M { username: string }

function buildWith(descriptor: FeatureDescriptor & { minLength?: number }) {
  return TestBed.runInInjectionContext(() => {
    const model = signal<M>({ username: '' });
    return form(
      model,
      schema<M>((p) => {
        applyFeature(p.username, descriptor, {
          requiredMessage: 'Username is required',
        });
      }),
    );
  });
}

describe('applyFeature', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideExperimentalZonelessChangeDetection()],
    }),
  );

  it('marks the field invalid when mandatory and empty', () => {
    const f = buildWith({ mandatory: true });
    expect(f.username().valid()).toBe(false);
    expect(f.username().errors()[0]?.message).toBe('Username is required');
  });

  it('does not require the field when not mandatory', () => {
    const f = buildWith({ mandatory: false });
    expect(f.username().valid()).toBe(true);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — `applyFeature`/`flow-def` not found.

- [ ] **Step 3: Write `flow-def.ts` (the contract).**

```ts
import type { InputSignal, Injector, Type, WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

// ---- Backend envelope: uniform { features, terms }; keys differ per flow -----------

/** The base every feature descriptor shares, regardless of which feature it is. */
export interface FeatureDescriptor {
  readonly mandatory: boolean;
  // room for cross-feature fields later: visible?, label?, …
}
/** A flow's feature set: a map keyed by feature code; each value EXTENDS the base. */
export type FeatureMap = Readonly<Record<string, FeatureDescriptor>>;

export interface TermDescriptor {
  readonly title: string;
  readonly body: string;
  readonly required: boolean;
}
export type TermsMap = Readonly<Record<string, TermDescriptor>>;

export interface FlowEnvelope<Features extends FeatureMap = FeatureMap> {
  readonly features: Features;
  readonly terms: TermsMap;
}

// ---- Submission outcome (realistic HTTP status semantics) --------------------------

export interface ServerFieldError {
  readonly field: string;
  readonly message: string;
}
export interface Signature {
  readonly challengeId: string;
  readonly code: string; // opaque one-time proof
}
export type SubmitOutcome =
  | { readonly status: 'ok'; readonly httpStatus: 200; readonly confirmationId: string }
  | {
      readonly status: 'signing_required';
      readonly httpStatus: 202;
      readonly signingUrl: string;
      readonly challengeId: string;
    }
  | {
      readonly status: 'rejected';
      readonly httpStatus: 422;
      readonly errors: readonly ServerFieldError[];
    };

// ---- Form bundle -------------------------------------------------------------------

export interface FlowForm<Model> {
  readonly model: WritableSignal<Model>;
  readonly form: FieldTree<Model>;
}

// ---- Step contract (typed; engine binds a FIXED input set) -------------------------

/** Every step component implements this; the engine binds exactly these inputs. */
export interface StepComponent<Slice, Data = never> {
  readonly field: InputSignal<FieldTree<Slice>>;
  readonly showErrors: InputSignal<boolean>;
  readonly data?: InputSignal<Data>;
}

/** Stored shape (generics erased at the registry boundary). */
export interface StepDef<Model> {
  readonly key: string;
  readonly label: string;
  readonly component: Type<StepComponent<unknown, unknown>>;
  field(form: FieldTree<Model>): FieldTree<unknown>;
  data?(env: FlowEnvelope): unknown;
}

/** Compile-time-safe constructor: `field`'s return type must match the component's Slice. */
export function defineStep<Model, Slice, Data = never>(cfg: {
  key: string;
  label: string;
  component: Type<StepComponent<Slice, Data>>;
  field: (form: FieldTree<Model>) => FieldTree<Slice>;
  data?: (env: FlowEnvelope) => Data;
}): StepDef<Model> {
  return cfg as unknown as StepDef<Model>;
}

// ---- The flow contract -------------------------------------------------------------

export interface FlowMeta {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly intro: string;
  readonly dimension: 'minimal' | 'complex' | 'signing';
}

export interface FlowDef<Model, Features extends FeatureMap = FeatureMap> {
  readonly meta: FlowMeta;
  readonly schemaVersion: number;
  buildForm(env: FlowEnvelope<Features>, injector: Injector): FlowForm<Model>;
  readonly steps: readonly StepDef<Model>[];
  toSubmission(model: Model): unknown;
  mapServerError?(
    err: ServerFieldError,
    form: FieldTree<Model>,
  ): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;
  restore?(raw: unknown): Model;
}

/** Generics-erased form used by the registry and the engine. */
export type AnyFlowDef = FlowDef<unknown, FeatureMap>;
```

- [ ] **Step 4: Write `schema-helpers.ts`.**

```ts
import { required, minLength, maxLength, type FieldPath } from '@angular/forms/signals';
import type { FeatureDescriptor } from './flow-def';

/** Optional length bounds many feature descriptors carry. */
export interface LengthBounds {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Feature-aware schema helper, reusable across every flow. Reads the shared
 * descriptor base (`mandatory`) and any common refinements (length bounds) and
 * applies the matching signal-forms validators to `node`.
 */
export function applyFeature<T extends string>(
  node: FieldPath<T>,
  descriptor: FeatureDescriptor & LengthBounds,
  opts: {
    readonly requiredMessage: string;
    readonly minLengthMessage?: (n: number) => string;
    readonly maxLengthMessage?: (n: number) => string;
  },
): void {
  if (descriptor.mandatory) {
    required(node, { message: opts.requiredMessage });
  }
  if (descriptor.minLength != null) {
    minLength(node, descriptor.minLength, {
      message:
        opts.minLengthMessage?.(descriptor.minLength) ??
        `Must be at least ${descriptor.minLength} characters`,
    });
  }
  if (descriptor.maxLength != null) {
    maxLength(node, descriptor.maxLength, {
      message:
        opts.maxLengthMessage?.(descriptor.maxLength) ??
        `Must be at most ${descriptor.maxLength} characters`,
    });
  }
}
```

> Note for the implementer: the exact parameter type for a schema path is whatever `@angular/forms/signals` exports for the callback argument of `schema((p) => …)` (it is `FieldPath<T>` in 21.2.x; if the symbol name differs, check the schema callback's parameter type via the `.d.ts` and adjust the import — do not invent a name). The behavior under test (required-when-mandatory) is the contract.

- [ ] **Step 5: Run the test to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `schema-helpers.spec.ts` PASS (both cases).

- [ ] **Step 6: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-def.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/schema-helpers.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/schema-helpers.spec.ts
git commit -m "feat(flow-forge): engine contract types + feature-aware schema helpers"
```

---

### Task 4: `createWizard()` headless controller

**Goal:** A pure-signals wizard controller owning phase/step/gate state and the frozen-snapshot validation, unit-tested without a DOM.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/wizard.ts`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/engine/wizard.spec.ts`

**Acceptance Criteria:**
- [ ] Validating a clean step clears its banner and returns true; navigation advances.
- [ ] Validating an invalid step freezes a deduped message snapshot, calls `reset()` on the state, returns false, and does not advance.
- [ ] `back()` from the first step sets phase to `intro`; otherwise decrements.
- [ ] `attempted` is true only after the current step has been validated.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → `wizard.spec.ts` passes.

**Steps:**

- [ ] **Step 1: Write the failing test.**

This adapts the gate semantics proven in `multi-step-flow.ts:55-241`, generalized to step keys. The controller validates against a minimal `StepState` interface so tests pass fakes.

`libs/tommy/signal-forms/flow-forge/src/lib/engine/wizard.spec.ts`:

```ts
import { createWizard, type StepState } from './wizard';

const STEPS = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
];

function fakeState(opts: {
  valid: boolean;
  errors?: { message?: string; fieldTree: unknown }[];
}): StepState & { resets: number } {
  let resets = 0;
  return {
    valid: () => opts.valid,
    errorSummary: () => opts.errors ?? [],
    reset: () => {
      resets++;
    },
    get resets() {
      return resets;
    },
  };
}

describe('createWizard', () => {
  it('starts on intro, step 0, not attempted', () => {
    const w = createWizard(STEPS);
    expect(w.phase()).toBe('intro');
    expect(w.stepIndex()).toBe(0);
    expect(w.currentKey()).toBe('a');
    expect(w.attempted()).toBe(false);
    expect(w.isFirst()).toBe(true);
    expect(w.isLast()).toBe(false);
  });

  it('advances on a valid step and clears the banner', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    const ok = w.next(fakeState({ valid: true }));
    expect(ok).toBe(true);
    expect(w.stepIndex()).toBe(1);
    expect(w.attempted()).toBe(true); // step b now has gate=[] from… no: only validated steps
    expect(w.bannerMessages()).toEqual([]);
  });

  it('freezes a deduped snapshot and resets on an invalid step', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    const fieldX = {};
    const state = fakeState({
      valid: false,
      errors: [
        { message: 'X required', fieldTree: fieldX },
        { message: 'X also bad', fieldTree: fieldX }, // same field → deduped out
        { message: 'Y required', fieldTree: {} },
      ],
    });
    const ok = w.next(state);
    expect(ok).toBe(false);
    expect(w.stepIndex()).toBe(0); // did not advance
    expect(w.attempted()).toBe(true);
    expect(w.bannerMessages()).toEqual(['X required', 'Y required']);
    expect(state.resets).toBe(1);
  });

  it('back() from step 0 returns to intro; otherwise decrements', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    w.stepIndex.set(1);
    w.back();
    expect(w.stepIndex()).toBe(0);
    w.back();
    expect(w.phase()).toBe('intro');
  });

  it('freezeBanner lets the runner inject server-error messages on a step', () => {
    const w = createWizard(STEPS);
    w.freezeBanner('a', ['That username is taken']);
    expect(w.stepIndex()).toBe(0);
    expect(w.bannerMessages()).toEqual(['That username is taken']);
    expect(w.attempted()).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — `./wizard` not found.

- [ ] **Step 3: Implement `wizard.ts`.**

```ts
import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

export type Phase = 'intro' | 'form' | 'done';

/** The minimal slice of a signal-forms FieldState the wizard needs to gate a step. */
export interface StepState {
  valid(): boolean;
  errorSummary(): readonly { readonly message?: string; readonly fieldTree: unknown }[];
  reset(): void;
}

export interface StepMeta {
  readonly key: string;
  readonly label: string;
}

export interface Wizard {
  readonly phase: WritableSignal<Phase>;
  readonly stepIndex: WritableSignal<number>;
  readonly steps: readonly StepMeta[];
  readonly labels: readonly string[];
  readonly currentKey: Signal<string>;
  readonly isFirst: Signal<boolean>;
  readonly isLast: Signal<boolean>;
  readonly attempted: Signal<boolean>;
  readonly bannerMessages: Signal<readonly string[]>;
  /** Validate the current step; advance to the next on success. Returns validity. */
  next(state: StepState): boolean;
  /** Validate the current step in place (used by Submit on the last step). */
  validateCurrent(state: StepState): boolean;
  back(): void;
  reset(): void;
  /** Force a frozen banner snapshot on a step (e.g. server errors) and navigate to it. */
  freezeBanner(key: string, messages: readonly string[]): void;
}

/**
 * Frozen-snapshot gate (ported from multi-step-flow.ts):
 *  - `null`  → step not validated yet
 *  - `[]`    → validated and clean
 *  - `[...]` → validated and invalid; a frozen snapshot of banner messages
 */
type Gate = Record<string, readonly string[] | null>;

function snapshotMessages(
  errors: readonly { readonly message?: string; readonly fieldTree: unknown }[],
): readonly string[] {
  const seen = new Set<unknown>();
  const messages: string[] = [];
  for (const error of errors) {
    if (seen.has(error.fieldTree)) continue;
    seen.add(error.fieldTree);
    if (error.message) messages.push(error.message);
  }
  return messages;
}

export function createWizard(steps: readonly StepMeta[]): Wizard {
  const phase = signal<Phase>('intro');
  const stepIndex = signal(0);
  const gate = signal<Gate>(
    Object.fromEntries(steps.map((s) => [s.key, null])),
  );

  const currentKey = computed(() => steps[stepIndex()].key);
  const isFirst = computed(() => stepIndex() === 0);
  const isLast = computed(() => stepIndex() === steps.length - 1);
  const attempted = computed(() => gate()[currentKey()] !== null);
  const bannerMessages = computed<readonly string[]>(
    () => gate()[currentKey()] ?? [],
  );

  const setGate = (key: string, value: readonly string[]) =>
    gate.update((g) => ({ ...g, [key]: value }));

  const validateCurrent = (state: StepState): boolean => {
    const key = currentKey();
    if (state.valid()) {
      setGate(key, []);
      return true;
    }
    setGate(key, snapshotMessages(state.errorSummary()));
    state.reset();
    return false;
  };

  const next = (state: StepState): boolean => {
    if (!validateCurrent(state)) return false;
    if (!isLast()) stepIndex.update((i) => i + 1);
    return true;
  };

  const back = (): void => {
    if (isFirst()) {
      phase.set('intro');
      return;
    }
    stepIndex.update((i) => i - 1);
  };

  const reset = (): void => {
    phase.set('intro');
    stepIndex.set(0);
    gate.set(Object.fromEntries(steps.map((s) => [s.key, null])));
  };

  const freezeBanner = (key: string, messages: readonly string[]): void => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx >= 0) stepIndex.set(idx);
    setGate(key, messages);
  };

  return {
    phase,
    stepIndex,
    steps,
    labels: steps.map((s) => s.label),
    currentKey,
    isFirst,
    isLast,
    attempted,
    bannerMessages,
    next,
    validateCurrent,
    back,
    reset,
    freezeBanner,
  };
}
```

- [ ] **Step 4: Run to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `wizard.spec.ts` PASS (all cases). If the "advances on a valid step" test's `attempted` assertion is ambiguous, note `attempted` reflects the *current* step (b), which has gate `null` until validated — adjust that single assertion to `expect(w.attempted()).toBe(false)` to match the spec semantics, since only step `a` was validated.

- [ ] **Step 5: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/wizard.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/wizard.spec.ts
git commit -m "feat(flow-forge): headless wizard controller with frozen-snapshot gate"
```

---

### Task 5: MitID plumbing — `ExternalRedirect`, `FlowStateStore`, `mitid.ts`

**Goal:** Injectable seams for leaving the SPA, a versioned single-use snapshot store, and the return-URL/callback contract — all unit-tested without real navigation.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/external-redirect.ts`
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-state-store.ts`
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.ts`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-state-store.spec.ts`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.spec.ts`

**Acceptance Criteria:**
- [ ] `FlowStateStore.save/restore` round-trips a snapshot; `restore` deletes it (single-use).
- [ ] `restore` returns null on `schemaVersion` mismatch and on absent data.
- [ ] `mitid.ts` builds a return URL on this origin and rejects a foreign `return` origin.
- [ ] `parseCallback` extracts `{ mitid, flow, status, state, code, challenge }` from a query map.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → both specs pass.

**Steps:**

- [ ] **Step 1: Write the failing tests.**

`libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-state-store.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { FlowStateStore } from './flow-state-store';

describe('FlowStateStore', () => {
  let store: FlowStateStore;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideExperimentalZonelessChangeDetection(), FlowStateStore],
    });
    store = TestBed.inject(FlowStateStore);
  });

  const snap = {
    flowSlug: 'bank',
    schemaVersion: 1,
    state: 'nonce-123',
    challengeId: 'ch-1',
    model: { a: 1 },
  };

  it('round-trips a snapshot', () => {
    store.save(snap);
    expect(store.restore('bank', 1)).toEqual(snap);
  });

  it('is single-use: a second restore returns null', () => {
    store.save(snap);
    store.restore('bank', 1);
    expect(store.restore('bank', 1)).toBeNull();
  });

  it('discards on schemaVersion mismatch', () => {
    store.save(snap);
    expect(store.restore('bank', 2)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(store.restore('bank', 1)).toBeNull();
  });
});
```

`libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.spec.ts`:

```ts
import { buildReturnUrl, isSameOrigin, parseCallback } from './mitid';

describe('mitid', () => {
  const origin = 'https://lab.example';

  it('builds a return URL on the given origin with flow + callback marker', () => {
    const url = buildReturnUrl(origin, 'bank');
    expect(url.startsWith(`${origin}/flow-forge?`)).toBe(true);
    const q = new URL(url).searchParams;
    expect(q.get('mitid')).toBe('callback');
    expect(q.get('flow')).toBe('bank');
  });

  it('accepts a same-origin return and rejects a foreign one', () => {
    expect(isSameOrigin('https://lab.example/flow-forge?x=1', origin)).toBe(true);
    expect(isSameOrigin('https://evil.example/flow-forge', origin)).toBe(false);
    expect(isSameOrigin('not a url', origin)).toBe(false);
  });

  it('parses a callback query map', () => {
    const map = new Map([
      ['mitid', 'callback'],
      ['flow', 'bank'],
      ['status', 'approved'],
      ['state', 'nonce-123'],
      ['code', 'otc-9'],
      ['challenge', 'ch-1'],
    ]);
    const get = (k: string) => map.get(k) ?? null;
    expect(parseCallback({ get })).toEqual({
      mitid: 'callback',
      flow: 'bank',
      status: 'approved',
      state: 'nonce-123',
      code: 'otc-9',
      challenge: 'ch-1',
    });
  });
});
```

- [ ] **Step 2: Run to verify they fail.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement `external-redirect.ts`.**

```ts
import { Injectable } from '@angular/core';

/**
 * Injectable seam over `window.location.href =`. Tests substitute a fake so they
 * never actually navigate. Also exposes the current origin for return-URL building.
 */
@Injectable({ providedIn: 'root' })
export class ExternalRedirect {
  get origin(): string {
    return window.location.origin;
  }
  to(url: string): void {
    window.location.href = url;
  }
}
```

- [ ] **Step 4: Implement `flow-state-store.ts`.**

```ts
import { Injectable } from '@angular/core';

const KEY = 'flow-forge:snapshot';

export interface FlowSnapshot {
  readonly flowSlug: string;
  readonly schemaVersion: number;
  readonly state: string; // correlation nonce
  readonly challengeId: string;
  readonly model: unknown; // already serialized via FlowDef.snapshot()
}

/**
 * Versioned, single-use sessionStorage snapshot for the MitID round-trip. The full
 * page unloads on redirect, so the model must survive here and be restored on boot.
 */
@Injectable({ providedIn: 'root' })
export class FlowStateStore {
  save(snapshot: FlowSnapshot): void {
    sessionStorage.setItem(KEY, JSON.stringify(snapshot));
  }

  /** Returns the snapshot and deletes it (single-use). Null if absent or stale. */
  restore(flowSlug: string, schemaVersion: number): FlowSnapshot | null {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY); // single-use: consume on read regardless
    if (!raw) return null;
    try {
      const snap = JSON.parse(raw) as FlowSnapshot;
      if (snap.flowSlug !== flowSlug) return null;
      if (snap.schemaVersion !== schemaVersion) return null;
      return snap;
    } catch {
      return null;
    }
  }

  clear(): void {
    sessionStorage.removeItem(KEY);
  }
}
```

- [ ] **Step 5: Implement `mitid.ts`.**

```ts
export interface Callback {
  readonly mitid: string | null;
  readonly flow: string | null;
  readonly status: string | null;
  readonly state: string | null;
  readonly code: string | null;
  readonly challenge: string | null;
}

/** Build the host callback URL the IdP must return to (this origin only). */
export function buildReturnUrl(origin: string, flowSlug: string): string {
  const u = new URL('/flow-forge', origin);
  u.searchParams.set('mitid', 'callback');
  u.searchParams.set('flow', flowSlug);
  return u.toString();
}

/** Reject a return URL whose origin is not ours (no open redirect). */
export function isSameOrigin(returnUrl: string, origin: string): boolean {
  try {
    return new URL(returnUrl).origin === origin;
  } catch {
    return false;
  }
}

/** Read callback fields off any query-map-like object (ActivatedRoute or a Map). */
export function parseCallback(q: { get(key: string): string | null }): Callback {
  return {
    mitid: q.get('mitid'),
    flow: q.get('flow'),
    status: q.get('status'),
    state: q.get('state'),
    code: q.get('code'),
    challenge: q.get('challenge'),
  };
}
```

- [ ] **Step 6: Run to verify they pass.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `flow-state-store.spec.ts` + `mitid.spec.ts` PASS.

- [ ] **Step 7: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/external-redirect.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-state-store.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-state-store.spec.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.spec.ts
git commit -m "feat(flow-forge): MitID seams — redirect, single-use state store, callback contract"
```

---

### Task 6: `FlowBackend` service + fixtures registry

**Goal:** One injectable service serving GET options and POST submit, keyed by slug, reading from a `FLOW_FIXTURES` registry; unit-tested with a synthetic fixture that exercises 200, 202, and 422.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-backend.ts`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-backend.spec.ts`

**Acceptance Criteria:**
- [ ] `loadOptions(slug)` resolves the fixture's `{ features, terms }`.
- [ ] `submit(slug, payload)` returns the fixture's outcome; passing a `signature` can flip a 202 fixture to 200.
- [ ] Unknown slug rejects.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → `flow-backend.spec.ts` passes.

**Steps:**

- [ ] **Step 1: Write the failing test.**

`libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-backend.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';
import type { SubmitOutcome } from './flow-def';

const signFixture: FlowFixture = {
  features: { AMOUNT: { mandatory: true, minAmount: 1 } },
  terms: { privacy: { title: 'P', body: 'b', required: true } },
  submit: (_payload, signature): SubmitOutcome =>
    signature
      ? { status: 'ok', httpStatus: 200, confirmationId: 'OK-1' }
      : {
          status: 'signing_required',
          httpStatus: 202,
          signingUrl: 'https://idp/sign?challenge=ch-1',
          challengeId: 'ch-1',
        },
};

describe('FlowBackend', () => {
  let backend: FlowBackend;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideExperimentalZonelessChangeDetection(),
        FlowBackend,
        { provide: FLOW_FIXTURES, useValue: new Map([['sign', signFixture]]) },
      ],
    });
    backend = TestBed.inject(FlowBackend);
  });

  it('loads options for a known slug', async () => {
    const env = await backend.loadOptions('sign');
    expect(env.features['AMOUNT'].mandatory).toBe(true);
    expect(env.terms['privacy'].required).toBe(true);
  });

  it('returns 202 without a signature and 200 with one', async () => {
    const a = await backend.submit('sign', {});
    expect(a.status).toBe('signing_required');
    const b = await backend.submit('sign', {}, { challengeId: 'ch-1', code: 'otc' });
    expect(b.status).toBe('ok');
  });

  it('rejects an unknown slug', async () => {
    await expect(backend.loadOptions('nope')).rejects.toBeTruthy();
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — `./flow-backend` not found.

- [ ] **Step 3: Implement `flow-backend.ts`.**

```ts
import { Injectable, InjectionToken, inject } from '@angular/core';
import type {
  FeatureMap,
  FlowEnvelope,
  Signature,
  SubmitOutcome,
  TermsMap,
} from './flow-def';

const DELAY_MS = 500;
function delay<T>(value: T, ms = DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** A flow's backend data + rules, contributed by `flows/<flow>/fixtures.ts`. */
export interface FlowFixture<Features extends FeatureMap = FeatureMap> {
  readonly features: Features;
  readonly terms: TermsMap;
  submit(payload: unknown, signature?: Signature): SubmitOutcome;
}

/** Registry of fixtures keyed by flow slug. */
export const FLOW_FIXTURES = new InjectionToken<Map<string, FlowFixture>>(
  'FLOW_FIXTURES',
);

/**
 * Stand-in for one real HTTP backend: every flow calls the same GET (options) and
 * the same POST (submit); only the slug + data differ. Deterministic on purpose.
 */
@Injectable({ providedIn: 'root' })
export class FlowBackend {
  private readonly fixtures = inject(FLOW_FIXTURES);

  private fixtureFor(slug: string): FlowFixture {
    const f = this.fixtures.get(slug);
    if (!f) throw new Error(`No fixture registered for flow "${slug}"`);
    return f;
  }

  loadOptions(slug: string): Promise<FlowEnvelope> {
    const f = this.fixtureFor(slug);
    return delay({ features: f.features, terms: f.terms });
  }

  submit(
    slug: string,
    payload: unknown,
    signature?: Signature,
  ): Promise<SubmitOutcome> {
    const f = this.fixtureFor(slug);
    return delay(f.submit(payload, signature));
  }
}
```

> Note: tests above provide `FLOW_FIXTURES` explicitly. The app wires the real map in Task 10 (the launcher) via `providers`. Because `FlowBackend` is `providedIn: 'root'` but depends on `FLOW_FIXTURES`, the token must be provided at the app/launcher level; provide it in the `FlowForge` launcher's `providers` array (Task 10).

- [ ] **Step 4: Run to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `flow-backend.spec.ts` PASS.

- [ ] **Step 5: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-backend.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-backend.spec.ts
git commit -m "feat(flow-forge): shared FlowBackend service + fixtures registry"
```

---

### Task 7: `<flow-runner>` — rendering & load

**Goal:** The engine component renders the intro/done chrome and the active step (via `NgComponentOutlet` with a fixed input set), and loads options to build the form. Submit coordination comes in Task 8.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts`
- Create (test helper): `libs/tommy/signal-forms/flow-forge/src/lib/engine/testing/test-flow.ts`

**Acceptance Criteria:**
- [ ] Intro renders `meta.title`/`meta.intro` and a Start button; Start loads options and shows step 0.
- [ ] The active step component receives `field`, `showErrors`, and `data` inputs.
- [ ] Next/Back navigate; the step indicator + error banner render.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → `flow-runner.spec.ts` rendering/nav cases pass.

**Steps:**

- [ ] **Step 1: Create a reusable test flow.**

`libs/tommy/signal-forms/flow-forge/src/lib/engine/testing/test-flow.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  input,
  runInInjectionContext,
  signal,
} from '@angular/core';
import { FormField, form, required, schema, type FieldTree } from '@angular/forms/signals';
import { defineStep, type FlowDef, type StepComponent } from '../flow-def';

interface TestModel {
  one: { name: string };
  two: { city: string };
}

@Component({
  selector: 'tommy-test-step-one',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input [formField]="field().name" id="t-name" />`,
})
export class TestStepOne implements StepComponent<TestModel['one']> {
  readonly field = input.required<FieldTree<TestModel['one']>>();
  readonly showErrors = input(false);
}

@Component({
  selector: 'tommy-test-step-two',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<input [formField]="field().city" id="t-city" />`,
})
export class TestStepTwo implements StepComponent<TestModel['two']> {
  readonly field = input.required<FieldTree<TestModel['two']>>();
  readonly showErrors = input(false);
}

export const testFlow: FlowDef<TestModel> = {
  meta: {
    slug: 'test',
    title: 'Test Flow',
    blurb: 'b',
    intro: 'intro copy',
    dimension: 'minimal',
  },
  schemaVersion: 1,
  buildForm: (_env, injector: Injector) => {
    const model = signal<TestModel>({ one: { name: '' }, two: { city: '' } });
    const tree = runInInjectionContext(injector, () =>
      form(
        model,
        schema<TestModel>((p) => {
          required(p.one.name, { message: 'Name required' });
          required(p.two.city, { message: 'City required' });
        }),
      ),
    );
    return { model, form: tree };
  },
  steps: [
    defineStep<TestModel, TestModel['one']>({
      key: 'one',
      label: 'One',
      component: TestStepOne,
      field: (f) => f.one,
    }),
    defineStep<TestModel, TestModel['two']>({
      key: 'two',
      label: 'Two',
      component: TestStepTwo,
      field: (f) => f.two,
    }),
  ],
  toSubmission: (m) => m,
};
```

- [ ] **Step 2: Write the failing rendering test.**

`libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { FlowRunner } from './flow-runner';
import { FlowBackend, FLOW_FIXTURES } from './flow-backend';
import { testFlow } from './testing/test-flow';

const fixtures = new Map([
  ['test', { features: {}, terms: {}, submit: () => ({ status: 'ok', httpStatus: 200, confirmationId: 'OK' }) }],
]);

async function setup() {
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      FlowBackend,
      { provide: FLOW_FIXTURES, useValue: fixtures },
    ],
  });
  const fixture = TestBed.createComponent(FlowRunner);
  fixture.componentRef.setInput('def', testFlow);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('FlowRunner — rendering & load', () => {
  it('renders the intro from meta', async () => {
    const fixture = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Test Flow');
    expect(text).toContain('intro copy');
  });

  it('Start loads options and shows the first step', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('button') as HTMLButtonElement).click(); // Start
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('#t-name')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — `./flow-runner` not found.

- [ ] **Step 4: Implement `flow-runner.ts` (rendering + load only; submit stub in this task).**

```ts
import { NgComponentOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';
import type { AnyFlowDef, FlowEnvelope, FlowForm } from './flow-def';
import { FlowBackend } from './flow-backend';
import { createWizard, type StepState, type Wizard } from './wizard';
import { FlowShell } from '../ui/flow-shell';
import { StepIndicator } from '../ui/step-indicator';
import { ErrorBanner } from '../ui/error-banner';

@Component({
  selector: 'tommy-flow-runner',
  imports: [NgComponentOutlet, FlowShell, StepIndicator, ErrorBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-runner.html',
})
export class FlowRunner {
  private readonly backend = inject(FlowBackend);
  private readonly injector = inject(Injector);

  readonly def = input.required<AnyFlowDef>();

  protected readonly env = signal<FlowEnvelope | null>(null);
  protected readonly flowForm = signal<FlowForm<unknown> | null>(null);
  protected readonly confirmationId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly starting = signal(false);
  protected readonly submitting = signal(false);

  // The wizard is created lazily once we know the def's steps.
  protected readonly wizard = computed<Wizard>(() =>
    createWizard(this.def().steps.map((s) => ({ key: s.key, label: s.label }))),
  );

  protected readonly currentStepDef = computed(() => {
    const w = this.wizard();
    return this.def().steps.find((s) => s.key === w.currentKey())!;
  });

  /** The fixed input set bound to the active step component. */
  protected readonly stepInputs = computed<Record<string, unknown>>(() => {
    const ff = this.flowForm();
    const env = this.env();
    const step = this.currentStepDef();
    if (!ff || !env) return {};
    return {
      field: step.field(ff.form),
      showErrors: this.wizard().attempted(),
      data: step.data?.(env),
    };
  });

  /** The active step's FieldState, used to gate Next/Submit. */
  protected currentStepState(): StepState | null {
    const ff = this.flowForm();
    if (!ff) return null;
    return step_state(this.currentStepDef().field(ff.form));
  }

  async start(): Promise<void> {
    if (this.flowForm()) {
      this.wizard().phase.set('form');
      return;
    }
    this.starting.set(true);
    this.loadError.set(null);
    try {
      const env = await this.backend.loadOptions(this.def().meta.slug);
      this.env.set(env);
      this.flowForm.set(this.def().buildForm(env, this.injector));
      this.wizard().stepIndex.set(0);
      this.wizard().phase.set('form');
    } catch {
      this.loadError.set('Could not start this flow. Please retry.');
    } finally {
      this.starting.set(false);
    }
  }

  next(): void {
    this.submitError.set(null);
    const state = this.currentStepState();
    if (state) this.wizard().next(state);
  }

  back(): void {
    this.submitError.set(null);
    this.wizard().back();
  }

  // Submit is implemented in Task 8.
  async onSubmit(): Promise<void> {
    /* implemented in Task 8 */
  }

  reset(): void {
    this.env.set(null);
    this.flowForm.set(null);
    this.confirmationId.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.starting.set(false);
    this.submitting.set(false);
    this.wizard().reset();
  }
}

/** Adapt a signal-forms FieldTree node to the wizard's StepState interface. */
function step_state(node: FieldTree<unknown>): StepState {
  const s = node();
  return {
    valid: () => s.valid(),
    errorSummary: () => s.errorSummary(),
    reset: () => s.reset(),
  };
}
```

> Implementer note: `computed(() => createWizard(...))` recreates the wizard if `def` changes identity. In this experiment `def` is set once per mounted runner, so the computed is effectively stable. If a flicker appears when switching flows, the launcher (Task 10) destroys/recreates the runner via `@if`, which is the intended lifecycle — keep the computed.

- [ ] **Step 5: Create the runner template.**

`libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.html`:

```html
<tommy-flow-shell>
  @let w = wizard();
  @switch (w.phase()) {

  @case ('intro') {
  <h2 class="ui-title">{{ def().meta.title }}</h2>
  <p class="ui-muted">{{ def().meta.intro }}</p>
  @if (loadError()) {
  <p class="ui-error">{{ loadError() }}</p>
  }
  <button
    type="button"
    class="ui-btn ui-btn-primary ui-foot"
    [disabled]="starting()"
    [attr.aria-busy]="starting()"
    (click)="start()"
  >
    @if (starting()) {
    <span class="ui-spinner" aria-hidden="true"></span> Starting…
    } @else { Start }
  </button>
  }

  @case ('done') {
  <h2 class="ui-title"><span aria-hidden="true">🎉</span> All set!</h2>
  <p>Your confirmation id is <strong>{{ confirmationId() }}</strong>.</p>
  <button type="button" class="ui-btn ui-foot" (click)="reset()">Start over</button>
  }

  @case ('form') { @if (flowForm()) {
  <tommy-step-indicator [labels]="w.labels" [activeIndex]="w.stepIndex()" />
  <tommy-error-banner [messages]="w.bannerMessages()" />

  <ng-container
    [ngComponentOutlet]="currentStepDef().component"
    [ngComponentOutletInputs]="stepInputs()"
  />

  @if (submitError()) {
  <p class="ui-error">{{ submitError() }}</p>
  }

  <div class="ui-row ui-foot">
    <button type="button" class="ui-btn" (click)="back()">Back</button>
    @if (w.isLast()) {
    <button
      type="button"
      class="ui-btn ui-btn-primary"
      [disabled]="submitting()"
      [attr.aria-busy]="submitting()"
      (click)="onSubmit()"
    >
      @if (submitting()) {
      <span class="ui-spinner" aria-hidden="true"></span> Submitting…
      } @else { Submit }
    </button>
    } @else {
    <button type="button" class="ui-btn ui-btn-primary" (click)="next()">Next</button>
    }
  </div>
  } } }
</tommy-flow-shell>
```

- [ ] **Step 6: Run to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `flow-runner.spec.ts` rendering/load cases PASS. (If `NgComponentOutletInputs` requires a non-empty object on first render, the `stepInputs()` empty-object guard handles the pre-load case.)

- [ ] **Step 7: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.html \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/testing/test-flow.ts
git commit -m "feat(flow-forge): flow-runner rendering + options load"
```

---

### Task 8: `<flow-runner>` — submission via signal-forms `submit()` (200 / 422 / 202)

**Goal:** Implement `onSubmit()` through root `submit()`, handling success (200 → done), validation rejection (422 → mapped field errors + navigate), and the 202 signing branch (persist snapshot + redirect via the seam).

**Files:**
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts`

**Acceptance Criteria:**
- [ ] On a clean last step with an `ok` fixture, submit sets phase to `done` and shows the confirmation id.
- [ ] On a `rejected` (422) fixture, the mapped error's message is frozen on its step's banner and the runner navigates to that step (default mapper → first step / root).
- [ ] On a `signing_required` (202) fixture, a snapshot (with a `state` nonce) is saved and `ExternalRedirect.to` is called with a same-origin `return` and the nonce; no navigation happens in tests (seam faked).

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → submit cases pass.

**Steps:**

- [ ] **Step 1: Write the failing submit tests.**

Append to `flow-runner.spec.ts` (add imports for `ExternalRedirect`, `FlowStateStore`, and outcome-specific fixtures):

```ts
import { ExternalRedirect } from './external-redirect';
import { FlowStateStore } from './flow-state-store';

class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'https://lab.example';
  to(url: string) { this.lastUrl = url; }
}

async function setupWith(outcome: 'ok' | 'rejected' | 'signing') {
  const submit = () =>
    outcome === 'ok'
      ? { status: 'ok', httpStatus: 200, confirmationId: 'OK-9' }
      : outcome === 'rejected'
      ? { status: 'rejected', httpStatus: 422, errors: [{ field: 'one.name', message: 'Name taken' }] }
      : { status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/sign?challenge=ch-1', challengeId: 'ch-1' };
  const redirect = new FakeRedirect();
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [
      provideExperimentalZonelessChangeDetection(),
      FlowBackend,
      FlowStateStore,
      { provide: ExternalRedirect, useValue: redirect },
      { provide: FLOW_FIXTURES, useValue: new Map([['test', { features: {}, terms: {}, submit }]]) },
    ],
  });
  const fixture = TestBed.createComponent(FlowRunner);
  fixture.componentRef.setInput('def', testFlow);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, redirect };
}

async function fillAndReachLastStep(fixture: Awaited<ReturnType<typeof setupWith>>['fixture']) {
  const el = fixture.nativeElement as HTMLElement;
  (el.querySelector('button') as HTMLButtonElement).click(); // Start
  await fixture.whenStable(); fixture.detectChanges();
  // step one: fill name, Next
  const name = el.querySelector('#t-name') as HTMLInputElement;
  name.value = 'Tom'; name.dispatchEvent(new Event('input'));
  await fixture.whenStable(); fixture.detectChanges();
  (el.querySelectorAll('button')[1] as HTMLButtonElement).click(); // Next (Back is [0])
  await fixture.whenStable(); fixture.detectChanges();
  // step two: fill city
  const city = el.querySelector('#t-city') as HTMLInputElement;
  city.value = 'CPH'; city.dispatchEvent(new Event('input'));
  await fixture.whenStable(); fixture.detectChanges();
}

describe('FlowRunner — submission', () => {
  it('ok → done with confirmation id', async () => {
    const { fixture } = await setupWith('ok');
    await fillAndReachLastStep(fixture);
    const el = fixture.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Submit')) as HTMLButtonElement).click();
    await fixture.whenStable(); fixture.detectChanges();
    expect(el.textContent).toContain('All set');
    expect(el.textContent).toContain('OK-9');
  });

  it('signing_required → saves snapshot with state + redirects same-origin', async () => {
    const { fixture, redirect } = await setupWith('signing');
    await fillAndReachLastStep(fixture);
    const el = fixture.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => b.textContent?.includes('Submit')) as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(redirect.lastUrl).toBeTruthy();
    const url = new URL(redirect.lastUrl!);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('return')).toContain(redirect.origin);
  });
});
```

- [ ] **Step 2: Run to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — `onSubmit` is a stub (no `done`, no redirect).

- [ ] **Step 3: Implement `onSubmit()` (adapt the proven pattern in `multi-step-flow.ts:148-190`).**

Add imports to `flow-runner.ts`:

```ts
import { submit } from '@angular/forms/signals';
import { ExternalRedirect } from './external-redirect';
import { FlowStateStore } from './flow-state-store';
import { buildReturnUrl } from './mitid';
import type { ServerFieldError, SubmitOutcome } from './flow-def';
```

Inject the seams in the class body:

```ts
  private readonly redirect = inject(ExternalRedirect);
  private readonly store = inject(FlowStateStore);
```

Replace the stub `onSubmit` with:

```ts
  async onSubmit(): Promise<void> {
    const ff = this.flowForm();
    if (!ff) return;
    const state = this.currentStepState();
    if (!state || !this.wizard().validateCurrent(state)) return;

    this.submitError.set(null);
    this.confirmationId.set(null);
    this.submitting.set(true);

    let outcome: SubmitOutcome | null = null;
    try {
      await submit(ff.form, {
        action: async (field) => {
          const payload = this.def().toSubmission(field().value());
          outcome = await this.backend.submit(this.def().meta.slug, payload);
          if (outcome.status === 'ok') {
            this.confirmationId.set(outcome.confirmationId);
            return null;
          }
          if (outcome.status === 'signing_required') {
            this.beginSigning(outcome.challengeId, outcome.signingUrl, ff);
            return null; // page is about to unload
          }
          // rejected (422): fold errors back onto the tree
          return outcome.errors.map((e) => this.toServerError(e, ff.form));
        },
      });
    } catch {
      this.submitError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.submitting.set(false);
    }

    if (this.confirmationId()) {
      this.wizard().phase.set('done');
      return;
    }
    if (outcome && outcome.status === 'rejected') {
      this.placeRejection(outcome.errors, ff);
    }
  }

  private toServerError(e: ServerFieldError, form: FieldTree<unknown>) {
    const mapped = this.def().mapServerError?.(e, form);
    return {
      kind: 'server' as const,
      message: e.message,
      fieldTree: mapped?.fieldTree ?? form,
    };
  }

  /** After a 422, freeze the banner on the mapped step and navigate to it. */
  private placeRejection(
    errors: readonly ServerFieldError[],
    ff: FlowForm<unknown>,
  ): void {
    const def = this.def();
    const first = errors[0];
    const mapped = first ? def.mapServerError?.(first, ff.form) : undefined;
    const stepKey = mapped?.stepKey ?? def.steps[0].key;
    const node = (mapped?.fieldTree ?? ff.form) as FieldTree<unknown>;
    node().reset();
    this.wizard().freezeBanner(
      stepKey,
      errors.map((e) => e.message),
    );
  }

  /** 202 branch: snapshot (with a state nonce) then leave the SPA. */
  private beginSigning(
    challengeId: string,
    signingUrl: string,
    ff: FlowForm<unknown>,
  ): void {
    const def = this.def();
    const state = crypto.randomUUID();
    const model = def.snapshot
      ? def.snapshot(ff.model())
      : JSON.parse(JSON.stringify(ff.model()));
    this.store.save({
      flowSlug: def.meta.slug,
      schemaVersion: def.schemaVersion,
      state,
      challengeId,
      model,
    });
    const returnUrl = buildReturnUrl(this.redirect.origin, def.meta.slug);
    const u = new URL(signingUrl);
    u.searchParams.set('state', state);
    u.searchParams.set('return', returnUrl);
    this.redirect.to(u.toString());
  }
```

- [ ] **Step 4: Run to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: submission cases PASS. If the 422 navigation assertion is flaky because `submit()` also marks fields touched, rely on the banner-message assertion (the message text) rather than DOM focus.

- [ ] **Step 5: AOT template check.**

Run: `pnpm nx build tommy-host`
Expected: succeeds (validates `strictTemplates` for the runner template incl. `ngComponentOutlet`). Per the spec, NgComponentOutlet *inputs* are not type-checked — the `defineStep` factory + the per-step contract (steps implement `StepComponent`) cover that.

- [ ] **Step 6: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts
git commit -m "feat(flow-forge): submit via signal-forms submit() with 200/202/422 handling"
```

---

### Task 9: The newsletter flow (minimal) + shared TOS step

**Goal:** The minimal flow — contact + prefs + TOS steps — proving low per-flow cost, plus the shared `tos-step` reused by later flows.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/steps/tos-step.ts`
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/flows/newsletter/model.ts`
- Create: `.../flows/newsletter/schema.ts`
- Create: `.../flows/newsletter/fixtures.ts`
- Create: `.../flows/newsletter/steps/contact-step.ts`
- Create: `.../flows/newsletter/steps/prefs-step.ts`
- Create: `.../flows/newsletter/def.ts`
- Test: `.../flows/newsletter/schema.spec.ts`

**Acceptance Criteria:**
- [ ] The schema requires name + email (valid email), and requires accepting each required term.
- [ ] `emptyModel(env)` derives the TOS acceptance array from `env.terms` (map → array bridge).
- [ ] `newsletterFlow` is a complete `FlowDef` with 3 steps.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → `newsletter/schema.spec.ts` passes.

**Steps:**

- [ ] **Step 1: Create the shared TOS step + model type.**

`libs/tommy/signal-forms/flow-forge/src/lib/steps/tos-step.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { TermsMap } from '../engine/flow-def';
import type { StepComponent } from '../engine/flow-def';
import { FieldError } from '../ui/field-error';

/** One acceptance row in the form model (bridged from the terms map). */
export interface TosAck {
  id: string;
  required: boolean;
  accepted: boolean;
}

/** Build the model array from a terms map (preserves key/insertion order). */
export function tosAcksFrom(terms: TermsMap): TosAck[] {
  return Object.entries(terms).map(([id, t]) => ({
    id,
    required: t.required,
    accepted: false,
  }));
}

@Component({
  selector: 'tommy-tos-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    @let terms = data();
    <div class="ui-stack">
      @for (ack of f; track $index; let i = $index) {
        @let item = terms[ackId(i)];
        <label class="ui-tos-item">
          <input type="checkbox" [formField]="ack.accepted" />
          <span class="ui-field">
            <span>
              <strong>{{ item.title }}</strong>
              @if (item.required) {
                <span class="ui-required">*</span>
              }
            </span>
            <span class="ui-muted">{{ item.body }}</span>
            <tommy-field-error [field]="ack.accepted" [show]="showErrors()" />
          </span>
        </label>
      }
    </div>
  `,
})
export class TosStep implements StepComponent<TosAck[], TermsMap> {
  readonly field = input.required<FieldTree<TosAck[]>>();
  readonly showErrors = input(false);
  readonly data = input.required<TermsMap>();

  protected ackId(i: number): string {
    return this.field()[i]().value().id;
  }
}
```

> Implementer note: reading the term descriptor by the ack's `id` keeps the row and its copy aligned regardless of map ordering. If `data()[ackId(i)]` typing is awkward, expose a small `readonly entries = computed(...)` instead; the behavior (each required term must be accepted) is what the schema enforces.

- [ ] **Step 2: Write the failing schema test.**

`libs/tommy/signal-forms/flow-forge/src/lib/flows/newsletter/schema.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { newsletterFlow } from './def';
import type { FlowEnvelope } from '../../engine/flow-def';

const env: FlowEnvelope = {
  features: {
    NAME: { mandatory: true },
    EMAIL: { mandatory: true },
  },
  terms: {
    privacy: { title: 'Privacy', body: 'b', required: true },
    marketing: { title: 'Marketing', body: 'b', required: false },
  },
};

function build() {
  return TestBed.runInInjectionContext(() =>
    newsletterFlow.buildForm(env, TestBed.inject((await import('@angular/core')).Injector)),
  );
}

describe('newsletter schema', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideExperimentalZonelessChangeDetection()],
    }),
  );

  it('requires name and a valid email', () => {
    const { form } = TestBed.runInInjectionContext(() =>
      newsletterFlow.buildForm(env, TestBed.inject(NeedInjector)),
    );
    expect(form.contact.name().valid()).toBe(false);
    form.contact.email().value.set('not-an-email');
    expect(form.contact.email().valid()).toBe(false);
    form.contact.name().value.set('Tom');
    form.contact.email().value.set('tom@example.com');
    expect(form.contact.name().valid()).toBe(true);
    expect(form.contact.email().valid()).toBe(true);
  });

  it('requires accepting the required term only', () => {
    const { form } = TestBed.runInInjectionContext(() =>
      newsletterFlow.buildForm(env, TestBed.inject(NeedInjector)),
    );
    // privacy (required) unaccepted → invalid; marketing optional → fine
    expect(form.tos().valid()).toBe(false);
    form.tos[0]().value.update((v) => ({ ...v, accepted: true })); // privacy
    expect(form.tos().valid()).toBe(true);
  });
});
```

> Implementer note: the cleanest way to get an `Injector` in a Vitest spec is `TestBed.inject(Injector)` (import `Injector` from `@angular/core`). Replace the `NeedInjector`/dynamic-import sketch above with a top-level `import { Injector } from '@angular/core'` and `TestBed.inject(Injector)`. (The sketch is intentionally explicit about needing an injector; write it cleanly.)

- [ ] **Step 3: Run to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — `./def` not found.

- [ ] **Step 4: Implement the model.**

`.../flows/newsletter/model.ts`:

```ts
import type { FlowEnvelope } from '../../engine/flow-def';
import { tosAcksFrom, type TosAck } from '../../steps/tos-step';

export type Frequency = 'daily' | 'weekly' | 'monthly';

export interface NewsletterModel {
  contact: { name: string; email: string };
  prefs: { frequency: Frequency; topics: string[] };
  tos: TosAck[];
}

export function emptyModel(env: FlowEnvelope): NewsletterModel {
  return {
    contact: { name: '', email: '' },
    prefs: { frequency: 'weekly', topics: [] },
    tos: tosAcksFrom(env.terms),
  };
}
```

- [ ] **Step 5: Implement the schema.**

`.../flows/newsletter/schema.ts`:

```ts
import {
  apply,
  applyEach,
  email,
  required,
  schema,
  validate,
} from '@angular/forms/signals';
import type { FlowEnvelope } from '../../engine/flow-def';
import type { NewsletterModel } from './model';

export function newsletterSchema(env: FlowEnvelope) {
  return schema<NewsletterModel>((p) => {
    apply(
      p.contact,
      schema((c) => {
        if (env.features['NAME']?.mandatory) {
          required(c.name, { message: 'Name is required' });
        }
        if (env.features['EMAIL']?.mandatory) {
          required(c.email, { message: 'Email is required' });
        }
        email(c.email, { message: 'Enter a valid email address' });
      }),
    );
    applyEach(p.tos, (item) => {
      validate(item.accepted, (ctx) =>
        ctx.valueOf(item.required) && !ctx.value()
          ? { kind: 'mustAccept', message: 'You must accept this to continue' }
          : null,
      );
    });
  });
}
```

- [ ] **Step 6: Implement the step components.**

`.../flows/newsletter/steps/contact-step.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { NewsletterModel } from '../model';
import { FieldError } from '../../../ui/field-error';

type Contact = NewsletterModel['contact'];

@Component({
  selector: 'tommy-newsletter-contact-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="nl-name">Name</label>
        <input id="nl-name" class="ui-input" [formField]="f.name" autocomplete="name" />
        <tommy-field-error [field]="f.name" [show]="showErrors()" />
      </div>
      <div class="ui-field">
        <label class="ui-label" for="nl-email">Email</label>
        <input id="nl-email" class="ui-input" [formField]="f.email" autocomplete="email" />
        <tommy-field-error [field]="f.email" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class ContactStep implements StepComponent<Contact> {
  readonly field = input.required<FieldTree<Contact>>();
  readonly showErrors = input(false);
}
```

`.../flows/newsletter/steps/prefs-step.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { NewsletterModel } from '../model';

type Prefs = NewsletterModel['prefs'];

@Component({
  selector: 'tommy-newsletter-prefs-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <fieldset class="ui-field">
        <legend class="ui-label">Frequency</legend>
        @for (opt of frequencies; track opt) {
          <label class="ui-row">
            <input type="radio" [value]="opt" [formField]="f.frequency" />
            <span>{{ opt }}</span>
          </label>
        }
      </fieldset>
    </div>
  `,
})
export class PrefsStep implements StepComponent<Prefs> {
  readonly field = input.required<FieldTree<Prefs>>();
  readonly showErrors = input(false);
  protected readonly frequencies = ['daily', 'weekly', 'monthly'] as const;
}
```

- [ ] **Step 7: Implement the fixture + the FlowDef.**

`.../flows/newsletter/fixtures.ts`:

```ts
import type { FlowFixture } from '../../engine/flow-backend';
import type { FeatureDescriptor } from '../../engine/flow-def';

export type NewsletterFeatures = {
  NAME: FeatureDescriptor;
  EMAIL: FeatureDescriptor;
};

export const newsletterFixture: FlowFixture<NewsletterFeatures> = {
  features: {
    NAME: { mandatory: true },
    EMAIL: { mandatory: true },
  },
  terms: {
    privacy: {
      title: 'Privacy Policy',
      body: 'We process your data as described in our policy.',
      required: true,
    },
    marketing: {
      title: 'Product updates',
      body: 'Send me occasional product news (optional).',
      required: false,
    },
  },
  submit: (payload) => ({
    status: 'ok',
    httpStatus: 200,
    confirmationId: `NEWS-${(payload as { contact?: { email?: string } }).contact?.email ?? 'x'}`,
  }),
};
```

`.../flows/newsletter/def.ts`:

```ts
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { defineStep, type FlowDef, type FlowEnvelope } from '../../engine/flow-def';
import { TosStep, type TosAck } from '../../steps/tos-step';
import { emptyModel, type NewsletterModel } from './model';
import { newsletterSchema } from './schema';
import { ContactStep } from './steps/contact-step';
import { PrefsStep } from './steps/prefs-step';

export const newsletterFlow: FlowDef<NewsletterModel> = {
  meta: {
    slug: 'newsletter',
    title: 'Subscribe to the newsletter',
    blurb: 'Two short steps and a consent — the minimal flow.',
    intro: 'Pick how often you want to hear from us. Quick and simple.',
    dimension: 'minimal',
  },
  schemaVersion: 1,
  buildForm: (env: FlowEnvelope, injector: Injector) => {
    const model = signal<NewsletterModel>(emptyModel(env));
    const tree = runInInjectionContext(injector, () =>
      form(model, newsletterSchema(env)),
    );
    return { model, form: tree };
  },
  steps: [
    defineStep<NewsletterModel, NewsletterModel['contact']>({
      key: 'contact',
      label: 'Contact',
      component: ContactStep,
      field: (f) => f.contact,
    }),
    defineStep<NewsletterModel, NewsletterModel['prefs']>({
      key: 'prefs',
      label: 'Preferences',
      component: PrefsStep,
      field: (f) => f.prefs,
    }),
    defineStep<NewsletterModel, TosAck[], FlowEnvelope['terms']>({
      key: 'tos',
      label: 'Terms',
      component: TosStep,
      field: (f) => f.tos,
      data: (env) => env.terms,
    }),
  ],
  toSubmission: (m) => ({
    contact: m.contact,
    prefs: m.prefs,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
```

- [ ] **Step 8: Run to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `newsletter/schema.spec.ts` PASS (clean up the injector sketch in the test per the note in Step 2).

- [ ] **Step 9: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/steps \
        libs/tommy/signal-forms/flow-forge/src/lib/flows/newsletter
git commit -m "feat(flow-forge): newsletter flow (minimal) + shared TOS step"
```

---

### Task 10: `FlowForge` launcher — gallery, runner mount, and MitID callback

**Goal:** Replace the placeholder with the real launcher: a flow gallery, mounting `<flow-runner>` for the selected flow, providing the `FLOW_FIXTURES` map, and handling the MitID callback (restore → re-submit / cancel) on boot.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/flow-registry.ts`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts`
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.html`
- Test: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.spec.ts`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/ui/ui.css` (gallery classes)

**Acceptance Criteria:**
- [ ] The gallery lists each registered flow with title, blurb, and a dimension badge; selecting one mounts `<flow-runner>`.
- [ ] `FLOW_FIXTURES` is provided from the registry (so `FlowBackend` resolves).
- [ ] On boot with `?mitid=callback&flow=newsletter&status=cancelled&state=…`, a matching saved snapshot is restored and the flow opens on its last step with a "Signing cancelled" banner; a non-matching `state` is ignored.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → `flow-forge.spec.ts` passes; `pnpm nx build tommy-host` → succeeds.

**Steps:**

- [ ] **Step 1: Create the flow registry + the fixtures map.**

`libs/tommy/signal-forms/flow-forge/src/lib/flow-registry.ts`:

```ts
import type { AnyFlowDef } from './engine/flow-def';
import type { FlowFixture } from './engine/flow-backend';
import { newsletterFlow } from './flows/newsletter/def';
import { newsletterFixture } from './flows/newsletter/fixtures';

/** All flows registered in this experiment (Plan 2 appends insurance + bank). */
export const FLOWS: readonly AnyFlowDef[] = [newsletterFlow as AnyFlowDef];

/** slug → fixture map consumed by FlowBackend (provided by the launcher). */
export const FIXTURES = new Map<string, FlowFixture>([
  ['newsletter', newsletterFixture as FlowFixture],
]);
```

- [ ] **Step 2: Write the failing launcher test.**

`libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { provideExperimentalZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FlowForge } from './flow-forge';

function routeWith(params: Record<string, string>) {
  const map = new Map(Object.entries(params));
  return { snapshot: { queryParamMap: { get: (k: string) => map.get(k) ?? null } } };
}

describe('FlowForge launcher', () => {
  it('renders a gallery card per flow', async () => {
    TestBed.configureTestingModule({
      imports: [FlowForge],
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeWith({}) },
      ],
    });
    const fixture = TestBed.createComponent(FlowForge);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Subscribe to the newsletter');
    expect(el.textContent?.toLowerCase()).toContain('minimal'); // dimension badge
  });

  it('selecting a flow mounts the runner', async () => {
    TestBed.configureTestingModule({
      imports: [FlowForge],
      providers: [
        provideExperimentalZonelessChangeDetection(),
        { provide: ActivatedRoute, useValue: routeWith({}) },
      ],
    });
    const fixture = TestBed.createComponent(FlowForge);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-flow="newsletter"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('tommy-flow-runner')).not.toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify it fails.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: FAIL — the placeholder has no gallery.

- [ ] **Step 4: Implement the launcher.**

`libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts`:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { AnyFlowDef } from './engine/flow-def';
import { FlowRunner } from './engine/flow-runner';
import { FLOW_FIXTURES } from './engine/flow-backend';
import { FIXTURES, FLOWS } from './flow-registry';
import { parseCallback } from './engine/mitid';

@Component({
  selector: 'tommy-flow-forge',
  imports: [FlowRunner],
  providers: [{ provide: FLOW_FIXTURES, useValue: FIXTURES }],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-forge.html',
})
export class FlowForge {
  private readonly route = inject(ActivatedRoute);

  protected readonly flows = FLOWS;
  protected readonly selected = signal<AnyFlowDef | null>(null);
  /** A banner shown when the user returns from a cancelled signing. */
  protected readonly returnNotice = signal<string | null>(null);

  constructor() {
    // MitID callback handling on boot. Plan 2 wires the approved→re-submit path
    // end-to-end with the bank flow; here we restore + open the flow (and surface
    // a cancellation notice). State/flow/origin validation lives in the runner/store.
    const cb = parseCallback(this.route.snapshot.queryParamMap);
    if (cb.mitid === 'callback' && cb.flow) {
      const def = FLOWS.find((f) => f.meta.slug === cb.flow);
      if (def) {
        this.selected.set(def);
        if (cb.status === 'cancelled') {
          this.returnNotice.set('Signing cancelled — you can review and resubmit.');
        }
      }
    }
  }

  select(def: AnyFlowDef): void {
    this.returnNotice.set(null);
    this.selected.set(def);
  }

  clear(): void {
    this.selected.set(null);
  }

  badgeClass(dimension: string): string {
    return dimension === 'signing'
      ? 'ui-badge-orange'
      : dimension === 'complex'
        ? 'ui-badge-green'
        : 'ui-badge-blue';
  }
}
```

`libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.html`:

```html
@if (selected(); as def) {
  @if (returnNotice(); as notice) {
    <p class="ui-banner-warning" role="status">{{ notice }}</p>
  }
  <button type="button" class="ui-btn ui-foot" (click)="clear()">← All flows</button>
  <tommy-flow-runner [def]="def" />
} @else {
  <header class="ui-stack">
    <h2 class="ui-title">Flow Forge</h2>
    <p class="ui-muted">
      One engine, many flows. Pick a flow to run it. Each stresses a different
      dimension of the abstraction.
    </p>
  </header>
  <ul class="ui-gallery">
    @for (flow of flows; track flow.meta.slug) {
      <li>
        <button
          type="button"
          class="ui-flow-card"
          [attr.data-flow]="flow.meta.slug"
          (click)="select(flow)"
        >
          <span class="ui-badge" [class]="badgeClass(flow.meta.dimension)">
            {{ flow.meta.dimension }}
          </span>
          <strong class="ui-title">{{ flow.meta.title }}</strong>
          <span class="ui-muted">{{ flow.meta.blurb }}</span>
        </button>
      </li>
    }
  </ul>
}
```

- [ ] **Step 5: Add gallery CSS classes.**

Append to `libs/tommy/signal-forms/flow-forge/src/lib/ui/ui.css`:

```css
/* ---- Flow gallery ------------------------------------------------------- */
.ui-gallery {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}
.ui-flow-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  text-align: left;
  padding: 1rem;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  cursor: pointer;
}
.ui-flow-card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
}
.ui-badge {
  align-self: flex-start;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
}
.ui-badge-blue { background: var(--badge-blue-bg); color: var(--badge-blue-fg); }
.ui-badge-green { background: var(--badge-green-bg); color: var(--badge-green-fg); }
.ui-badge-orange { background: var(--badge-orange-bg); color: var(--badge-orange-fg); }
```

- [ ] **Step 6: Run to verify it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: `flow-forge.spec.ts` PASS.
Run: `pnpm nx build tommy-host`
Expected: succeeds.

- [ ] **Step 7: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/flow-registry.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.html \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.spec.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/ui/ui.css
git commit -m "feat(flow-forge): launcher gallery + runner mount + MitID callback restore"
```

---

### Task 11: Documentation + full local CI

**Goal:** A lib README, the root README updated with the Flow Forge row, and a green full-suite run.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/README.md`
- Modify: `README.md` (experiments table)

**Acceptance Criteria:**
- [ ] Lib README documents the engine/flow split, the `FlowDef` contract, and how to add a flow.
- [ ] Root README lists Flow Forge in the experiments table.
- [ ] `pnpm check` passes (lint + test + typecheck + build across the workspace).

**Verify:** `pnpm check` → all targets pass.

**Steps:**

- [ ] **Step 1: Write the lib README.**

Create `libs/tommy/signal-forms/flow-forge/README.md` covering: the "standardize the skeleton, free the flesh" principle; the engine pieces (`wizard`, `flow-runner`, `flow-backend`, `flow-state-store`, `mitid`, `schema-helpers`); the `FlowDef`/`defineStep`/`StepComponent` contract; the `{ features, terms }` keyed-descriptor envelope; and a "How to add a flow" checklist (model → schema → steps → fixture → def → register in `flow-registry.ts`). Note that Plan 2 adds the insurance/bank flows + the cross-origin `mock-idp` round-trip.

- [ ] **Step 2: Add the Flow Forge row to the root README table.**

In `README.md`, add under the experiments table:

```markdown
| Flow Forge | A composable engine for signal-forms multi-step flows: one skeleton powers many flows (minimal, complex fields, MitID signing). |
```

- [ ] **Step 3: Run the full local suite.**

Run: `pnpm check`
Expected: `lint`, `test`, `typecheck`, `build` all PASS across the workspace (this includes the `tommy-host` AOT build — the real `strictTemplates` gate).

- [ ] **Step 4: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/README.md README.md
git commit -m "docs(flow-forge): lib README + root experiments table row"
```

---

## Self-Review

**Spec coverage (Plan 1 scope):**
- Hybrid engine (wizard + flow-runner) → Tasks 4, 7, 8 ✓
- `FlowDef`/`StepDef`/`StepComponent`/`defineStep` (AOT-safe step contract, #1) → Task 3 ✓
- Shared `FlowBackend` + fixtures + `{features,terms}` keyed descriptor maps + `applyFeature` → Tasks 3, 6, 9 ✓
- Signal-forms `submit()` with 200/422 + default root mapper (#2) → Task 8 ✓
- 202 step-up plumbing: `state` nonce, single-use versioned snapshot, same-origin return (#3, #4) → Tasks 5, 8 ✓ (real cross-origin round-trip = Plan 2)
- `.ui-*` layer + CDK LiveAnnouncer → Task 2 ✓
- Host one-line registration + gallery launcher → Tasks 1, 10 ✓
- Newsletter (minimal) flow → Task 9 ✓
- Deferred to Plan 2 (explicitly): insurance flow, bank flow, `mock-idp` app, real cross-origin approved→resubmit round-trip, focus-on-step-change (`afterNextRender`), root README run/Vercel notes.

**Placeholder scan:** No "TBD/TODO". Two test sketches (Task 9 injector, Task 4 `attempted` assertion) carry explicit "write it cleanly / adjust this assertion" implementer notes rather than leaving ambiguity — acceptable, they name the exact fix.

**Type consistency:** `StepComponent`/`FieldTree` inputs, `SubmitOutcome` variants, `FlowSnapshot` fields (`flowSlug`/`schemaVersion`/`state`/`challengeId`/`model`), `FLOW_FIXTURES` token, and `defineStep` signatures are used consistently across Tasks 3–10. `createWizard` API (`next`/`validateCurrent`/`freezeBanner`/`bannerMessages`) matches between Task 4 and its consumers in Tasks 7–8.

**Note on `afterNextRender` focus management:** deferred to Plan 2 (it pairs naturally with the more complex flows); the engine is structured so it can be added in `flow-runner` without contract changes.
