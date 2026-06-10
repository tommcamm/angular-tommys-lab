# Flow Compose Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `engine/` grab-bag with concern-named folders (`runner/`, `io/`, `forms/`), delete the per-flow `form.ts` + `runInInjectionContext`, and hoist the repeated per-flow wiring into a `createFlow()` composable — with no behavior change.

**Architecture:** Pure structure + dedupe refactor of `libs/tommy/signal-forms/flow-compose`. Step 1 relocates files and fixes imports (mechanical, behavior-preserving). Steps 2–3 add two new modules (`buildFlowForm`, `createFlow`). Step 4 migrates the three flow components onto `createFlow` and deletes their `form.ts`. Step 5 updates the README. Verified throughout by the existing spec suite, two new specs, and the `tommy-host` AOT `strictTemplates` build.

**Tech Stack:** Angular 21.2 (zoneless host; zone-based lib specs via `@analogjs/vitest-angular`), `@angular/forms/signals`, Nx 22, pnpm, Vitest.

**Key fact that makes this safe:** `form(model, schema, { injector })` — the 3-arg overload (`@angular/forms/.../_structure-chunk.d.ts:1533`) accepts a `FormOptions` whose `injector` field replaces `form()`'s internal `inject(Injector)` fallback. So `runInInjectionContext` is unnecessary. `untracked` stays (the form is built inside a `computed`, and `form()` registers an internal `effect()`, forbidden in a reactive context).

**Spec:** `docs/superpowers/specs/2026-06-10-flow-compose-refactor-design.md`

**Project names:** lib = `tommy-signal-forms-flow-compose`; AOT host = `tommy-host`. All commands run from repo root.

---

### Task 1: Relocate `engine/` → `runner/`/`io/`/`forms/` + root; fix all imports

**Goal:** Move the 14 `engine/` files into concern-named folders, merge the 9-line `resume.ts` type into `flow-resume.ts`, and re-path every import — with the full suite and AOT build still green. No logic changes.

**Files:**
- Move (git mv): all of `libs/tommy/signal-forms/flow-compose/src/lib/engine/*` per the table below
- Modify (imports only): every file listed in the rewrite sections below
- Modify: `libs/tommy/signal-forms/flow-compose/src/index.ts`
- Delete: `libs/tommy/signal-forms/flow-compose/src/lib/engine/resume.ts` (type folded into `io/flow-resume.ts`)

**Acceptance Criteria:**
- [ ] `engine/` folder no longer exists; files live under `runner/`, `io/`, `forms/`, and `flow-types.ts` at lib root
- [ ] `grep -rn "engine/" libs/tommy/signal-forms/flow-compose` returns nothing
- [ ] `pnpm nx test tommy-signal-forms-flow-compose` — all existing specs pass
- [ ] `pnpm nx build tommy-host` — AOT `strictTemplates` green
- [ ] No behavior change (no source logic edited, only file locations + import specifiers)

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose && pnpm nx build tommy-host` → both pass; `grep -rn "engine/" libs/tommy/signal-forms/flow-compose` → empty

**Steps:**

- [ ] **Step 1: Move the files with `git mv` (preserves history).**

Run from repo root:

```bash
cd libs/tommy/signal-forms/flow-compose/src/lib
mkdir -p runner/testing io forms

# runner/ — the composition kit + its private state machine + test host
git mv engine/flow-runner.ts        runner/flow-runner.ts
git mv engine/flow-runner.html      runner/flow-runner.html
git mv engine/flow-runner.spec.ts   runner/flow-runner.spec.ts
git mv engine/flow-step.ts          runner/flow-step.ts
git mv engine/flow-step.spec.ts     runner/flow-step.spec.ts
git mv engine/flow-slots.ts         runner/flow-slots.ts
git mv engine/flow-slots.spec.ts    runner/flow-slots.spec.ts
git mv engine/flow-config.ts        runner/flow-config.ts
git mv engine/wizard.ts             runner/wizard.ts
git mv engine/wizard.spec.ts        runner/wizard.spec.ts
git mv engine/testing/test-host.ts  runner/testing/test-host.ts

# io/ — backend + MitID seams
git mv engine/flow-backend.ts          io/flow-backend.ts
git mv engine/flow-backend.spec.ts     io/flow-backend.spec.ts
git mv engine/flow-state-store.ts      io/flow-state-store.ts
git mv engine/flow-state-store.spec.ts io/flow-state-store.spec.ts
git mv engine/flow-resume.ts           io/flow-resume.ts
git mv engine/flow-resume.spec.ts      io/flow-resume.spec.ts
git mv engine/mitid.ts                 io/mitid.ts
git mv engine/mitid.spec.ts            io/mitid.spec.ts
git mv engine/external-redirect.ts     io/external-redirect.ts

# forms/ — schema utilities
git mv engine/schema-helpers.ts        forms/schema-helpers.ts
git mv engine/schema-helpers.spec.ts   forms/schema-helpers.spec.ts

# root — shared vocabulary
git mv engine/flow-types.ts            flow-types.ts

# resume.ts is deleted in Step 4 after its type is merged into io/flow-resume.ts
cd -
```

- [ ] **Step 2: Rewrite the relative imports INSIDE the moved files.** Apply exactly these (specifiers not listed are unchanged):

`runner/flow-runner.ts`:
```ts
import type { FlowConfig } from './flow-config';                 // unchanged
import type { ServerFieldError, Signature, SubmitOk, SubmitOutcome } from '../flow-types';
import { FlowStep } from './flow-step';                          // unchanged
import { FlowIntro, FlowReceipt } from './flow-slots';           // unchanged
import { FlowBackend } from '../io/flow-backend';
import { ExternalRedirect } from '../io/external-redirect';
import { FlowStateStore } from '../io/flow-state-store';
import { buildReturnUrl } from '../io/mitid';
import { createWizard, type StepState, type Wizard } from './wizard';   // unchanged
import { FlowShell } from '../ui/flow-shell';                    // unchanged
import { StepIndicator } from '../ui/step-indicator';            // unchanged
import { ErrorBanner } from '../ui/error-banner';                // unchanged
```

`runner/flow-config.ts`: `import type { FlowMeta, ServerFieldError } from '../flow-types';`
`runner/flow-slots.ts`: `import type { SubmitOk } from '../flow-types';`
`runner/flow-step.ts`: no relative imports — unchanged.
`runner/wizard.ts`: no relative imports — unchanged.

`runner/testing/test-host.ts`:
```ts
import type { Signature } from '../../flow-types';
import type { FlowConfig } from '../flow-config';     // unchanged
import { FlowRunner } from '../flow-runner';          // unchanged
import { FlowStep } from '../flow-step';              // unchanged
import { FlowIntro, FlowReceipt } from '../flow-slots'; // unchanged
```

`runner/flow-runner.spec.ts`:
```ts
import { TestHost } from './testing/test-host';                        // unchanged
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from '../io/flow-backend';
import { ExternalRedirect } from '../io/external-redirect';
import { FlowStateStore } from '../io/flow-state-store';
```

`runner/flow-slots.spec.ts`: `import { FlowIntro, FlowReceipt } from './flow-slots';` (unchanged) and `import type { SubmitOk } from '../flow-types';`
`runner/flow-step.spec.ts`: `import { FlowStep } from './flow-step';` — unchanged.
`runner/wizard.spec.ts`: `import { createWizard, type StepState } from './wizard';` — unchanged.

`io/flow-backend.ts`: `} from '../flow-types';` (the multi-line type import)
`io/flow-backend.spec.ts`: `import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';` (unchanged) and `import type { SubmitOutcome } from '../flow-types';`
`io/flow-state-store.ts`: no relative imports — unchanged.
`io/flow-state-store.spec.ts`: `import { FlowStateStore } from './flow-state-store';` — unchanged.
`io/flow-resume.ts`: `import { FlowStateStore } from './flow-state-store';` and `import { parseCallback } from './mitid';` stay; the `import type { PendingResume } from './resume';` line is removed in Step 3.
`io/flow-resume.spec.ts`: both imports (`./flow-resume`, `./flow-state-store`) — unchanged.
`io/mitid.ts` / `io/mitid.spec.ts` / `io/external-redirect.ts`: unchanged.

`forms/schema-helpers.ts`: `import type { FeatureDescriptor } from '../flow-types';`
`forms/schema-helpers.spec.ts`: `import { applyFeature, type LengthBounds } from './schema-helpers';` (unchanged) and `import type { FeatureDescriptor } from '../flow-types';`

`flow-types.ts` (root): no relative imports — unchanged.

- [ ] **Step 3: Merge `resume.ts`'s `PendingResume` into `io/flow-resume.ts`, then delete `resume.ts`.**

In `io/flow-resume.ts`, change the top imports from:
```ts
import { Injectable, inject } from '@angular/core';
import { FlowStateStore } from './flow-state-store';
import { parseCallback } from './mitid';
import type { PendingResume } from './resume';
```
to:
```ts
import { Injectable, inject } from '@angular/core';
import type { Signature } from '../flow-types';
import { FlowStateStore } from './flow-state-store';
import { parseCallback } from './mitid';

/** What the flow component + runner consult after a MitID round-trip. */
export interface PendingResume {
  /** The serialized model from the single-use snapshot (already `config.snapshot`-shaped). */
  readonly model: unknown;
  /** The MitID proof: challenge id + the one-time code returned by the provider. */
  readonly signature: Signature;
}
```
Then delete the old file:
```bash
git rm libs/tommy/signal-forms/flow-compose/src/lib/engine/resume.ts
```

> `PendingResume` is now exported from `io/flow-resume.ts`. The only other importer was `engine/flow-resume.ts` itself (now the definition site). No external file imported `resume.ts`.

- [ ] **Step 4: Rewrite the EXTERNAL importers (files outside the moved folders).** Mapping rule: in each specifier, replace `engine/<name>` with the new location — `runner/` for `flow-runner|flow-step|flow-slots|flow-config`, `io/` for `flow-backend|flow-state-store|flow-resume|mitid|external-redirect`, `forms/` for `schema-helpers`, and drop `engine/` entirely for `flow-types` (now at lib root). Concretely:

`index.ts` — full replacement:
```ts
export { FlowCompose } from './lib/flow-compose';
export { FlowRunner } from './lib/runner/flow-runner';
export { FlowStep, type FlowStepContext } from './lib/runner/flow-step';
export { FlowIntro, FlowReceipt, type FlowReceiptContext } from './lib/runner/flow-slots';
export type { FlowConfig } from './lib/runner/flow-config';
export type {
  FlowMeta,
  FlowEnvelope,
  FeatureMap,
  FeatureDescriptor,
  TermsMap,
  TermDescriptor,
  ServerFieldError,
  Signature,
  SubmitOk,
  SubmitOutcome,
} from './lib/flow-types';
```
> `createFlow` / `buildFlowForm` exports are added in Tasks 3 and 2 — not here.

`lib/flow-cards.ts:1`: `import type { FlowMeta } from './flow-types';`
`lib/flow-compose.ts:3`: `import { FLOW_FIXTURES, FlowBackend } from './io/flow-backend';`
`lib/flow-compose.ts:4`: `import { FlowResume } from './io/flow-resume';`
`lib/flow-compose.spec.ts:4`: `import { FlowResume } from './io/flow-resume';`
`lib/flow-compose.spec.ts:5`: `import { FlowStateStore } from './io/flow-state-store';`
`lib/flow-fixtures.ts:1`: `import type { FlowFixture } from './io/flow-backend';`
`lib/steps/tos-step.ts:3`: `import type { TermsMap } from '../flow-types';`

`lib/flows/bank/bank-config.ts:1`: `import type { FlowConfig } from '../../runner/flow-config';`
`lib/flows/bank/bank-flow.ts` lines 2–7:
```ts
import type { Signature } from '../../flow-types';
import { FlowBackend } from '../../io/flow-backend';
import { FlowResume } from '../../io/flow-resume';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
```
`lib/flows/bank/fixtures.ts` lines 1–3:
```ts
import type { FlowFixture } from '../../io/flow-backend';
import type { FeatureDescriptor, SubmitOutcome } from '../../flow-types';
import { MOCK_IDP_ORIGIN } from '../../io/mitid';
```
`lib/flows/bank/form.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`
`lib/flows/bank/round-trip.spec.ts` lines 4–7:
```ts
import { FlowBackend, FLOW_FIXTURES } from '../../io/flow-backend';
import { ExternalRedirect } from '../../io/external-redirect';
import { FlowStateStore } from '../../io/flow-state-store';
import { FlowResume } from '../../io/flow-resume';
```
`lib/flows/bank/schema.spec.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`
`lib/flows/bank/schema.ts:2`: `import { applyFeature } from '../../forms/schema-helpers';`
`lib/flows/bank/schema.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`

`lib/flows/insurance/insurance-config.ts:1`: `import type { FlowConfig } from '../../runner/flow-config';`
`lib/flows/insurance/insurance-flow.ts` lines 2–7: same six-line block as bank (Signature → `../../flow-types`; FlowBackend/FlowResume → `../../io/…`; FlowRunner/FlowStep/FlowIntro+FlowReceipt → `../../runner/…`).
`lib/flows/insurance/fixtures.ts:1`: `import type { FlowFixture } from '../../io/flow-backend';`
`lib/flows/insurance/fixtures.ts:2`: `import type { FeatureDescriptor } from '../../flow-types';`
`lib/flows/insurance/form.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`
`lib/flows/insurance/schema.spec.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`
`lib/flows/insurance/schema.ts:2`: `import { applyFeature } from '../../forms/schema-helpers';`
`lib/flows/insurance/schema.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`

`lib/flows/newsletter/newsletter-config.ts:1`: `import type { FlowConfig } from '../../runner/flow-config';`
`lib/flows/newsletter/newsletter-flow.ts` lines 2–7: same six-line block as bank.
`lib/flows/newsletter/fixtures.ts:1`: `import type { FlowFixture } from '../../io/flow-backend';`
`lib/flows/newsletter/fixtures.ts:2`: `import type { FeatureDescriptor } from '../../flow-types';`
`lib/flows/newsletter/form.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`
`lib/flows/newsletter/schema.spec.ts:3`: `import type { FlowEnvelope } from '../../flow-types';`
`lib/flows/newsletter/schema.ts:2`: `import type { FlowEnvelope } from '../../flow-types';`

> The flow components and `form.ts` files keep working with these re-pathed imports; Tasks 3–4 then supersede them with `createFlow` and delete `form.ts`.

- [ ] **Step 5: Verify no stale references, then build + test.**

```bash
grep -rn "engine/" libs/tommy/signal-forms/flow-compose   # expect: no output
pnpm nx test tommy-signal-forms-flow-compose               # expect: all pass
pnpm nx build tommy-host                                   # expect: AOT green
pnpm nx lint tommy-signal-forms-flow-compose               # expect: 0 errors
```

- [ ] **Step 6: Commit.**

```bash
git add -A libs/tommy/signal-forms/flow-compose
git commit -m "refactor(flow-compose): split engine/ into runner/io/forms + root types"
```

---

### Task 2: Add `forms/build-flow-form.ts` (kills `runInInjectionContext`)

**Goal:** A single generic helper that builds a signal-forms `form()` via the `{ injector }` option inside `untracked`, with a spec proving it works inside a `computed` (the reactive-context case that `untracked` exists for). Export it from the barrel.

**Files:**
- Create: `libs/tommy/signal-forms/flow-compose/src/lib/forms/build-flow-form.ts`
- Test: `libs/tommy/signal-forms/flow-compose/src/lib/forms/build-flow-form.spec.ts`
- Modify: `libs/tommy/signal-forms/flow-compose/src/index.ts`

**Acceptance Criteria:**
- [ ] `buildFlowForm(model, schemaFn, env, injector)` returns a usable `FieldTree<M>`
- [ ] Building it inside a `computed` body does not throw (regression guard for the reactive-context error)
- [ ] Exported from `index.ts`
- [ ] New spec passes; lib suite + `tommy-host` build stay green

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose` → `build-flow-form` specs pass; `pnpm nx build tommy-host` → green

**Steps:**

- [ ] **Step 1: Write the failing spec.**

Create `libs/tommy/signal-forms/flow-compose/src/lib/forms/build-flow-form.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { Injector, computed, signal } from '@angular/core';
import { schema, validate } from '@angular/forms/signals';
import { buildFlowForm } from './build-flow-form';
import type { FlowEnvelope } from '../flow-types';

interface M { name: string; }
const ENV: FlowEnvelope = { features: {}, terms: {} };
const nameSchema = (_env: FlowEnvelope) =>
  schema<M>((p) =>
    validate(p.name, (ctx) => (ctx.value() ? null : { kind: 'required', message: 'Name required' })),
  );

describe('buildFlowForm', () => {
  it('builds a usable form via the {injector} option (no runInInjectionContext)', () => {
    const injector = TestBed.inject(Injector);
    const model = signal<M>({ name: '' });
    const f = buildFlowForm(model, nameSchema, ENV, injector);
    expect(f.name().valid()).toBe(false);
    model.set({ name: 'Tommy' });
    expect(f.name().valid()).toBe(true);
  });

  it('can be built INSIDE a computed without throwing (untracked escapes the reactive context)', () => {
    const injector = TestBed.inject(Injector);
    const model = signal<M>({ name: 'x' });
    const formC = computed(() => buildFlowForm(model, nameSchema, ENV, injector));
    // The computed body is a reactive consumer; without untracked, form()'s internal
    // effect() creation throws NG0602. With untracked, reading formC() must succeed.
    expect(() => formC()).not.toThrow();
    expect(formC().name().valid()).toBe(true);
  });
});
```

- [ ] **Step 2: Run it; confirm it fails (module not found).**

Run: `pnpm nx test tommy-signal-forms-flow-compose -- build-flow-form`
Expected: FAIL — `Cannot find module './build-flow-form'`.

- [ ] **Step 3: Write the implementation.**

Create `libs/tommy/signal-forms/flow-compose/src/lib/forms/build-flow-form.ts`:
```ts
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
  schema: (env: FlowEnvelope) => SchemaOrSchemaFn<M>,
  env: FlowEnvelope,
  injector: Injector,
): FieldTree<M> {
  return untracked(() => form(model, schema(env), { injector }));
}
```

- [ ] **Step 4: Run the spec; confirm it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-compose -- build-flow-form`
Expected: PASS (both tests).

- [ ] **Step 5: Export from the barrel.** Add to `libs/tommy/signal-forms/flow-compose/src/index.ts` (after the `FlowConfig` export line):
```ts
export { buildFlowForm } from './lib/forms/build-flow-form';
```

- [ ] **Step 6: Full verify + commit.**

```bash
pnpm nx test tommy-signal-forms-flow-compose
pnpm nx build tommy-host
git add -A libs/tommy/signal-forms/flow-compose
git commit -m "feat(flow-compose): buildFlowForm helper (form() via {injector}, no runInInjectionContext)"
```

---

### Task 3: Add `create-flow.ts` composable

**Goal:** One composable that absorbs the env-resource + model signal + form computed + loadErrorMsg + signature-deferral + seedDefaults wiring currently copy-pasted into every flow component. Same logic, hoisted once. Export it from the barrel.

**Files:**
- Create: `libs/tommy/signal-forms/flow-compose/src/lib/create-flow.ts`
- Test: `libs/tommy/signal-forms/flow-compose/src/lib/create-flow.spec.ts`
- Modify: `libs/tommy/signal-forms/flow-compose/src/index.ts`

**Acceptance Criteria:**
- [ ] Fresh start: `model()` is `emptyModel()`; after env resolves, `form()` is defined and `seedDefaults` has run; `loadErrorMsg()` is null
- [ ] Resume: `model()` is the restored model; `seedDefaults` is NOT applied; `signature()` is set after render
- [ ] Load failure: `loadErrorMsg()` is the (default) message; `form()` stays undefined
- [ ] Exported from `index.ts`; lib suite + `tommy-host` build green

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose` → `create-flow` specs pass; `pnpm nx build tommy-host` → green

**Steps:**

- [ ] **Step 1: Write the failing spec.**

Create `libs/tommy/signal-forms/flow-compose/src/lib/create-flow.spec.ts`:
```ts
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormField, required, schema } from '@angular/forms/signals';
import { createFlow, type Flow } from './create-flow';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './io/flow-backend';
import { FlowResume } from './io/flow-resume';
import { FlowStateStore } from './io/flow-state-store';
import { ExternalRedirect } from './io/external-redirect';
import { FlowRunner } from './runner/flow-runner';
import { FlowStep } from './runner/flow-step';
import { FlowIntro, FlowReceipt } from './runner/flow-slots';
import type { FlowConfig } from './runner/flow-config';

interface M { one: { name: string }; }
const CONFIG: FlowConfig<M> = {
  meta: { slug: 'test', title: 'T', blurb: 'b', dimension: 'minimal' },
  schemaVersion: 1,
  toSubmission: (m) => m,
  restore: (raw) => raw as M,
};
const SCHEMA = (_env: unknown) => schema<M>((p) => required(p.one.name, { message: 'Name required' }));

@Component({
  selector: 'tommy-cf-host',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                       [resume]="flow.signature()" (retry)="flow.env.reload()">
      <ng-template flowIntro><p class="ui-muted">intro copy</p></ng-template>
      @if (flow.form(); as form) {
        <ng-template [flowStep]="form.one" flowStepKey="one" flowStepLabel="One" let-field let-showErrors="showErrors">
          <input [formField]="field.name" id="cf-name" />
        </ng-template>
      }
      <ng-template flowReceipt let-result><p id="cf-rcpt">done {{ result.confirmationId }}</p></ng-template>
    </tommy-flow-runner>
  `,
})
class CfHost {
  readonly flow: Flow<M> = createFlow<M>({
    config: CONFIG,
    schema: SCHEMA,
    emptyModel: () => ({ one: { name: '' } }),
    seedDefaults: (m) => (m.one.name ? m : { ...m, one: { name: 'seeded' } }),
  });
}

class FakeRedirect { lastUrl: string | null = null; origin = 'https://lab.example'; to(u: string) { this.lastUrl = u; } }

function providersWith(fixtures: Map<string, FlowFixture>) {
  return [
    FlowBackend, FlowStateStore, FlowResume,
    { provide: ExternalRedirect, useValue: new FakeRedirect() },
    { provide: FLOW_FIXTURES, useValue: fixtures },
  ];
}
const OK: FlowFixture['submit'] = (_p, sig) =>
  sig ? ({ status: 'ok', httpStatus: 200, confirmationId: 'SIGNED-1' } as const)
      : ({ status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/x', challengeId: 'c' } as const);

async function settle(fixture: ComponentFixture<unknown>, ms = 700) {
  await new Promise((r) => setTimeout(r, ms));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('createFlow', () => {
  afterEach(() => sessionStorage.clear());

  it('fresh start: emptyModel, then env resolves → form built + seedDefaults applied, no loadError', async () => {
    TestBed.configureTestingModule({ providers: providersWith(new Map([['test', { features: {}, terms: {}, submit: OK }]])) });
    const fixture = TestBed.createComponent(CfHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    // Before env resolves
    expect(host.flow.form()).toBeUndefined();
    expect(host.flow.signature()).toBeNull();
    expect(host.flow.loadErrorMsg()).toBeNull();
    expect(host.flow.model().one.name).toBe('');
    await settle(fixture);
    // After env resolves
    expect(host.flow.form()).toBeDefined();
    expect(host.flow.loadErrorMsg()).toBeNull();
    expect(host.flow.model().one.name).toBe('seeded'); // seedDefaults ran (fresh)
  });

  it('resume: restores model, skips seedDefaults, sets signature after render', async () => {
    // Arm the resume the way boot does: save a snapshot, then consume an approved callback.
    TestBed.configureTestingModule({ providers: providersWith(new Map([['test', { features: {}, terms: {}, submit: OK }]])) });
    TestBed.inject(FlowStateStore).save({ flowSlug: 'test', schemaVersion: 1, state: 'st-1', challengeId: 'c', model: { one: { name: 'Restored' } } });
    TestBed.inject(FlowResume).consume(
      { get: (k: string) => ({ mitid: 'callback', flow: 'test', status: 'approved', state: 'st-1', code: 'otc' } as Record<string, string>)[k] ?? null },
      () => 1,
    );
    const fixture = TestBed.createComponent(CfHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    expect(host.flow.model().one.name).toBe('Restored'); // restored at construction
    await settle(fixture);
    expect(host.flow.model().one.name).toBe('Restored'); // seedDefaults skipped on resume
    expect(host.flow.signature()).not.toBeNull();          // deferred signature fired
  });

  it('load failure (no fixture for slug) → loadErrorMsg set, form stays undefined', async () => {
    TestBed.configureTestingModule({ providers: providersWith(new Map()) }); // 'test' missing → loadOptions throws
    const fixture = TestBed.createComponent(CfHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    await settle(fixture);
    expect(host.flow.loadErrorMsg()).toBe('Could not start this flow. Please retry.');
    expect(host.flow.form()).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it; confirm it fails (module not found).**

Run: `pnpm nx test tommy-signal-forms-flow-compose -- create-flow`
Expected: FAIL — `Cannot find module './create-flow'`.

- [ ] **Step 3: Write the implementation.**

Create `libs/tommy/signal-forms/flow-compose/src/lib/create-flow.ts`:
```ts
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
  readonly env: ResourceRef<FlowEnvelope>;
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
```

- [ ] **Step 4: Run the spec; confirm it passes.**

Run: `pnpm nx test tommy-signal-forms-flow-compose -- create-flow`
Expected: PASS (all three tests).

> If the `resume` test is flaky on timing, raise the `settle()` delay (the backend uses a 500 ms fixture delay; 700 ms is the margin the existing `flow-runner.spec.ts` resume tests use).

- [ ] **Step 5: Export from the barrel.** Add to `libs/tommy/signal-forms/flow-compose/src/index.ts` (after the `buildFlowForm` export from Task 2):
```ts
export { createFlow, type CreateFlowOptions, type Flow } from './lib/create-flow';
```

- [ ] **Step 6: Full verify + commit.**

```bash
pnpm nx test tommy-signal-forms-flow-compose
pnpm nx build tommy-host
git add -A libs/tommy/signal-forms/flow-compose
git commit -m "feat(flow-compose): createFlow() composable hoisting per-flow wiring"
```

---

### Task 4: Migrate the three flow components to `createFlow`; delete the `form.ts` files

**Goal:** Replace each flow component's ~55 lines of wiring with a single `createFlow({...})` call, prefix the templates with `flow.`, and delete the three `form.ts` files. Behavior identical — proven by the existing suite + `round-trip.spec.ts` + AOT build.

**Files:**
- Modify: `libs/tommy/signal-forms/flow-compose/src/lib/flows/bank/bank-flow.ts` + `bank-flow.html`
- Modify: `libs/tommy/signal-forms/flow-compose/src/lib/flows/insurance/insurance-flow.ts` + `insurance-flow.html`
- Modify: `libs/tommy/signal-forms/flow-compose/src/lib/flows/newsletter/newsletter-flow.ts` + `newsletter-flow.html`
- Delete: `flows/bank/form.ts`, `flows/insurance/form.ts`, `flows/newsletter/form.ts`

**Acceptance Criteria:**
- [ ] Each flow component is `createFlow({...})` + `@Component` metadata only (no env/model/form/loadError/signature/effect wiring)
- [ ] Each template binds `flow.config`, `flow.form()`, `flow.loadErrorMsg()`, `flow.signature()`, `flow.env.*`
- [ ] The three `form.ts` files are deleted; no remaining `runInInjectionContext` in the lib
- [ ] `pnpm nx test tommy-signal-forms-flow-compose` (incl. `round-trip.spec.ts`) green; `pnpm nx build tommy-host` AOT green

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose && pnpm nx build tommy-host` → both pass; `grep -rn "runInInjectionContext" libs/tommy/signal-forms/flow-compose/src` → empty

**Steps:**

- [ ] **Step 1: Rewrite `bank-flow.ts`** (full replacement):
```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createFlow } from '../../create-flow';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
import { ApplicantStep } from './steps/applicant-step';
import { AccountTypeStep } from './steps/account-type-step';
import { BANK_FLOW_CONFIG } from './bank-config';
import { emptyBankModel, type BankModel } from './model';
import { bankSchema } from './schema';

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

- [ ] **Step 2: Rewrite `bank-flow.html`** (full replacement):
```html
<tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                   [resume]="flow.signature()" (retry)="flow.env.reload()">

  <ng-template flowIntro>
    <h2 class="ui-title">Open a bank account</h2>
    <p class="ui-muted">Open a new account. You will confirm with MitID before we create it.</p>
    @if (flow.env.isLoading()) { <p class="ui-muted"><span class="ui-spinner" aria-hidden="true"></span> Loading options…</p> }
  </ng-template>

  @if (flow.form(); as form) {
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
      <tommy-tos-step [field]="field" [terms]="flow.env.value()!.terms" [showErrors]="showErrors" />
    </ng-template>
  }

  <ng-template flowReceipt let-result>
    <h2 class="ui-title"><span aria-hidden="true">🎉</span> Account opened</h2>
    <p>Your confirmation id is <strong>{{ result.confirmationId }}</strong>.</p>
  </ng-template>
</tommy-flow-runner>
```

- [ ] **Step 3: Rewrite `insurance-flow.ts`** (full replacement):
```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createFlow } from '../../create-flow';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
import { PolicyStep } from './steps/policy-step';
import { IncidentStep } from './steps/incident-step';
import { ItemsStep } from './steps/items-step';
import { INSURANCE_FLOW_CONFIG } from './insurance-config';
import { emptyInsuranceModel, type InsuranceModel } from './model';
import { insuranceSchema } from './schema';

@Component({
  selector: 'tommy-insurance-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, PolicyStep, IncidentStep, ItemsStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './insurance-flow.html',
})
export class InsuranceFlow {
  protected readonly flow = createFlow<InsuranceModel>({
    config: INSURANCE_FLOW_CONFIG,
    schema: insuranceSchema,
    emptyModel: emptyInsuranceModel,
    seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }),
  });
}
```
> Verified exports: `insuranceSchema` (schema.ts), `emptyInsuranceModel` (model.ts); the `InsuranceModel` carries a `tos` field, so `seedDefaults` applies.

- [ ] **Step 4: Rewrite `insurance-flow.html`** (full replacement):
```html
<tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                   [resume]="flow.signature()" (retry)="flow.env.reload()">

  <ng-template flowIntro>
    <h2 class="ui-title">File an insurance claim</h2>
    <p class="ui-muted">Tell us what happened and itemise your claim. We will check the total against your coverage.</p>
    @if (flow.env.isLoading()) { <p class="ui-muted"><span class="ui-spinner" aria-hidden="true"></span> Loading options…</p> }
  </ng-template>

  @if (flow.form(); as form) {
    <ng-template [flowStep]="form.policy" flowStepKey="policy" flowStepLabel="Policy"
                 let-field let-showErrors="showErrors">
      <tommy-insurance-policy-step [field]="field" [showErrors]="showErrors" />
    </ng-template>
    <ng-template [flowStep]="form.incident" flowStepKey="incident" flowStepLabel="Incident"
                 let-field let-showErrors="showErrors">
      <tommy-insurance-incident-step [field]="field" [showErrors]="showErrors" />
    </ng-template>
    <ng-template [flowStep]="form.items" flowStepKey="items" flowStepLabel="Items"
                 let-field let-showErrors="showErrors">
      <tommy-insurance-items-step [field]="field" [showErrors]="showErrors" />
    </ng-template>
    <ng-template [flowStep]="form.tos" flowStepKey="tos" flowStepLabel="Terms"
                 let-field let-showErrors="showErrors">
      <tommy-tos-step [field]="field" [terms]="flow.env.value()!.terms" [showErrors]="showErrors" />
    </ng-template>
  }

  <ng-template flowReceipt let-result>
    <h2 class="ui-title">Claim filed</h2>
    <p>Your confirmation id is <strong>{{ result.confirmationId }}</strong>.</p>
  </ng-template>
</tommy-flow-runner>
```

- [ ] **Step 5: Rewrite `newsletter-flow.ts`** (full replacement):
```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createFlow } from '../../create-flow';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
import { ContactStep } from './steps/contact-step';
import { PrefsStep } from './steps/prefs-step';
import { NEWSLETTER_FLOW_CONFIG } from './newsletter-config';
import { emptyNewsletterModel, type NewsletterModel } from './model';
import { newsletterSchema } from './schema';

@Component({
  selector: 'tommy-newsletter-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, ContactStep, PrefsStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './newsletter-flow.html',
})
export class NewsletterFlow {
  protected readonly flow = createFlow<NewsletterModel>({
    config: NEWSLETTER_FLOW_CONFIG,
    schema: newsletterSchema,
    emptyModel: emptyNewsletterModel,
    seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }),
  });
}
```
> Verified exports: `newsletterSchema` (schema.ts), `emptyNewsletterModel` (model.ts); the `NewsletterModel` carries a `tos` field, so `seedDefaults` applies.

- [ ] **Step 6: Rewrite `newsletter-flow.html`** (full replacement):
```html
<tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                   [resume]="flow.signature()" (retry)="flow.env.reload()">

  <ng-template flowIntro>
    <h2 class="ui-title">Subscribe to the newsletter</h2>
    <p class="ui-muted">Pick how often you want to hear from us. Quick and simple.</p>
    @if (flow.env.isLoading()) { <p class="ui-muted"><span class="ui-spinner" aria-hidden="true"></span> Loading options…</p> }
  </ng-template>

  @if (flow.form(); as form) {
    <ng-template [flowStep]="form.contact" flowStepKey="contact" flowStepLabel="Contact"
                 let-field let-showErrors="showErrors">
      <tommy-newsletter-contact-step [field]="field" [showErrors]="showErrors" />
    </ng-template>
    <ng-template [flowStep]="form.prefs" flowStepKey="prefs" flowStepLabel="Preferences"
                 let-field let-showErrors="showErrors">
      <tommy-newsletter-prefs-step [field]="field" [showErrors]="showErrors" />
    </ng-template>
    <ng-template [flowStep]="form.tos" flowStepKey="tos" flowStepLabel="Terms"
                 let-field let-showErrors="showErrors">
      <tommy-tos-step [field]="field" [terms]="flow.env.value()!.terms" [showErrors]="showErrors" />
    </ng-template>
  }

  <ng-template flowReceipt let-result>
    <h2 class="ui-title">You're subscribed</h2>
    <p>Your confirmation id is <strong>{{ result.confirmationId }}</strong>.</p>
  </ng-template>
</tommy-flow-runner>
```

- [ ] **Step 7: Delete the three `form.ts` files.**
```bash
git rm libs/tommy/signal-forms/flow-compose/src/lib/flows/bank/form.ts \
       libs/tommy/signal-forms/flow-compose/src/lib/flows/insurance/form.ts \
       libs/tommy/signal-forms/flow-compose/src/lib/flows/newsletter/form.ts
```

- [ ] **Step 8: Verify behavior unchanged + commit.**
```bash
grep -rn "runInInjectionContext" libs/tommy/signal-forms/flow-compose/src   # expect: empty
pnpm nx test tommy-signal-forms-flow-compose      # expect: all pass (incl. round-trip.spec.ts)
pnpm nx build tommy-host                          # expect: AOT strictTemplates green
pnpm nx lint tommy-signal-forms-flow-compose      # expect: 0 errors
git add -A libs/tommy/signal-forms/flow-compose
git commit -m "refactor(flow-compose): flows use createFlow(); delete per-flow form.ts"
```

---

### Task 5: Update the README

**Goal:** Bring `README.md` in line with the new structure: the contract paths, the `form.ts`-free "How to add a flow" steps with `createFlow`, and the "ledger" paragraph that no longer claims ~55–90 lines of per-flow repetition (that cost is now erased).

**Files:**
- Modify: `libs/tommy/signal-forms/flow-compose/README.md`

**Acceptance Criteria:**
- [ ] No mention of `engine/`, `form.ts`, or `runInInjectionContext` as a required per-flow step
- [ ] "How to add a flow" lists the `createFlow({...})` component shape and the new folder names
- [ ] The "Gained/Lost/Deferred" ledger reflects that per-flow wiring is now hoisted into `createFlow` (the "~55–90 lines of declarative repetition" framing is updated)
- [ ] `pnpm nx lint tommy-signal-forms-flow-compose` green (README change is docs-only)

**Verify:** Read the README top-to-bottom; `grep -nE "engine/|form\.ts|runInInjectionContext" libs/tommy/signal-forms/flow-compose/README.md` → only historical/ledger mentions, none as live instructions

**Steps:**

- [ ] **Step 1: Update the "How to add a flow" section.** Replace the per-flow file list so it drops `form.ts` and the `runInInjectionContext` step, and reduces the component to a `createFlow` call. The new step 5–7 read:
  - **`model.ts`** — the `Model` interface + `emptyModel()` factory.
  - **`schema.ts`** — a `schema<Model>(env)` builder; reuse `applyFeature` (now in `forms/`).
  - **`fixtures.ts`** — a `FlowFixture`.
  - **`steps/*`** — one component per step (reuse the shared `tos-step`).
  - **`<name>-config.ts`** — the `FlowConfig<Model>` constant.
  - **`<name>-flow.ts`** — the component: `@Component` metadata + `protected readonly flow = createFlow<Model>({ config, schema, emptyModel, seedDefaults? })`. No `form.ts`, no env/model/form/signature wiring.
  - **`<name>-flow.html`** — the template; wire `<tommy-flow-runner>` binding `flow.config`/`flow.form()`/`flow.loadErrorMsg()`/`flow.signature()`/`flow.env.*` with `flowStep`/`flowIntro`/`flowReceipt` slots.
  - Registration touchpoints (`flow-cards.ts`, `flow-fixtures.ts`, `@case`, host registry) — unchanged.

- [ ] **Step 2: Update the file-tree / contract paths** anywhere the README references `engine/...` to the new `runner/`, `io/`, `forms/`, and root `flow-types.ts` / `create-flow.ts` locations.

- [ ] **Step 3: Rewrite the ledger.** In "Lost", replace the "~55–90 lines of declarative repetition" paragraph: the env-resource + model + form + loadError + signature block is no longer per-flow — it lives once in `createFlow`. What remains per-flow is the `createFlow({...})` config object plus the two required `flowIntro`/`flowReceipt` slots (still the genuinely-varying parts). In "Deferred", drop or soften item 1 (the generator was "the sharpest argument against the per-flow repetition cost" — `createFlow` now addresses most of that cost directly).

- [ ] **Step 4: Verify + commit.**
```bash
pnpm nx lint tommy-signal-forms-flow-compose
git add libs/tommy/signal-forms/flow-compose/README.md
git commit -m "docs(flow-compose): README for runner/io/forms layout + createFlow authoring"
```

---

## Notes for the implementer

- **Lib specs are zone-based** (`src/test-setup.ts` → `setupTestBed({ zoneless: false })`), so the new specs use real `setTimeout` + `await fixture.whenStable()` + `fixture.detectChanges()` (matching `flow-runner.spec.ts`). Do not switch them to zoneless idioms.
- **The AOT gate is `pnpm nx build tommy-host`** — the lib's own `typecheck` is plain `tsc` and misses template errors (NG8002/NG8022). Always run the host build before claiming a task done.
- **The host registers flows via the barrel** (`@tommy/signal-forms-flow-compose`), so the folder moves don't touch the host as long as `index.ts` keeps its exports — the host build confirms this.
