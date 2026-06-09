# Flow Compose (Flow Forge v2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `@tommy/signal-forms/flow-compose` — a sibling lib that reframes a signal-forms multi-step flow from *data interpreted by an engine* (`FlowDef.steps[]` + `NgComponentOutlet`) into *a template that composes engine parts* (`<flow-runner>` + `<ng-template flowStep>`, CDK-stepper shape), with per-flow `flowIntro`/`flowReceipt` slots and a runner-owned error page.

**Architecture:** A thin `FlowRunner` shell owns the phase machine (`intro|form|done|error`), the standardized footers, the validity gate (`createWizard`), the `submit()` state machine, and the MitID round-trip. It queries its content: `contentChildren(FlowStep)` for ordered steps and `contentChild.required(FlowIntro/FlowReceipt)` for the two presentation slots. Each flow is a component that owns its `env` (resource), `model`, and `form`, and declares its steps + slots as projected `<ng-template>` content — so every step/slot binding is checked by `strictTemplates`. A single-read `FlowResume` service fronts the single-use MitID snapshot for two consumers (flow restores the model; runner re-submits the signature). v1 (`flow-forge`) is left untouched for an A/B comparison.

**Tech Stack:** Angular 21.2.x (signals, `resource`, `contentChildren`/`contentChild.required`, structural directive + `ngTemplateContextGuard`, `@angular/forms/signals`), Nx 22.7.5, Vitest + jsdom, zoneless host.

**Design spec:** `docs/superpowers/specs/2026-06-09-flow-compose-v2-design.md`

**Conventions used throughout (per the design):**
- The new lib **copies** v1's unchanged primitives verbatim and applies only the listed edits (it must not import from `flow-forge`).
- The sessionStorage snapshot KEY and the MitID return path change from `flow-forge` to `flow-compose` (self-contained; no collision with v1).
- `phase` lifts off the wizard onto the runner (so the intro chrome renders before the wizard captures its step set).

---

### Task 1: Scaffold the lib + copy the unchanged engine/ui primitives

**Goal:** A self-contained `tommy-signal-forms-flow-compose` library with v1's unchanged primitives copied in (wizard with `phase` removed), all copied specs green.

**Files:**
- Create (generator): `libs/tommy/signal-forms/flow-compose/` (project.json, vite.config.mts, tsconfig*.json, eslint.config.mjs, src/test-setup.ts, src/index.ts)
- Create: `src/lib/engine/flow-types.ts` (the trimmed types; `flow-backend`/`schema-helpers` depend on it, so it lands here, not in Task 2)
- Modify: `tsconfig.base.json` (add the `@tommy/signal-forms/flow-compose` path)
- Copy verbatim (v1 → new lib, identical paths under `src/lib/`): `engine/external-redirect.ts`, `ui/flow-shell.ts`, `ui/step-indicator.ts`, `ui/error-banner.ts` (+`.spec.ts`), `ui/field-error.ts` (+`.spec.ts`), `ui/ui.css`
- Copy with edits (`./flow-def` → `./flow-types`): `engine/flow-backend.ts` (+`.spec.ts`), `engine/schema-helpers.ts` (+`.spec.ts`)
- Copy with edits: `engine/mitid.ts` (+`.spec.ts`), `engine/flow-state-store.ts` (+`.spec.ts`), `engine/wizard.ts` (+`.spec.ts`)
- Test: the copied specs above

**Note:** `flow-types.ts` is a near-verbatim trimmed copy of v1 `flow-def.ts` (the contract additions — `FlowConfig`, `FlowStep`, the slots — come in Task 2). It is created here because the copied `flow-backend`/`schema-helpers` import their types from it.

**Acceptance Criteria:**
- [ ] `pnpm nx lint tommy-signal-forms-flow-compose` passes
- [ ] `pnpm nx test tommy-signal-forms-flow-compose` runs and the copied specs pass
- [ ] `wizard.ts` exposes no `phase` (it lives on the runner now); `wizard.spec.ts` passes without phase assertions
- [ ] No file in the new lib imports from `@tommy/signal-forms/flow-forge` or `../flow-forge`

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose` → all copied specs pass.

**Steps:**

- [ ] **Step 1: Generate the library** (mirrors v1's vitest/tags config)

Use the `nx-generate` skill, or run:
```bash
pnpm nx g @nx/angular:library libs/tommy/signal-forms/flow-compose \
  --name=tommy-signal-forms-flow-compose --unitTestRunner=vitest --bundler=none \
  --prefix=tommy --tags=scope:tommy,type:experiment --standalone --skipModule --dry-run
```
Inspect the dry-run, then re-run without `--dry-run`. After generation, confirm `project.json` has `"tags": ["scope:tommy", "type:experiment"]` and `vite.config.mts` `test.name` is `tommy-signal-forms-flow-compose`. Delete any generated demo component/spec so `src/lib/` starts empty except `index.ts`.

- [ ] **Step 2: Add the TS path alias**

In `tsconfig.base.json`, add inside `compilerOptions.paths` (after the `flow-forge` entry):
```json
"@tommy/signal-forms/flow-compose": [
  "./libs/tommy/signal-forms/flow-compose/src/index.ts"
]
```

- [ ] **Step 3: Create `flow-types.ts`** (the trimmed contract types; `flow-backend`/`schema-helpers` depend on it)

```ts
import type { FieldTree } from '@angular/forms/signals';

// ---- Backend envelope: uniform { features, terms }; keys differ per flow ----------
export interface FeatureDescriptor {
  readonly mandatory: boolean;
}
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
  readonly code: string;
}
/** The 200 arm of SubmitOutcome — exported for the receipt slot context. */
export type SubmitOk = {
  readonly status: 'ok';
  readonly httpStatus: 200;
  readonly confirmationId: string;
};
export type SubmitOutcome =
  | SubmitOk
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

// ---- Flow meta (no `intro` — the flowIntro slot owns intro copy) -------------------
export interface FlowMeta {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly dimension: 'minimal' | 'complex' | 'signing';
}

export type { FieldTree };
```

- [ ] **Step 3b: Copy the verbatim primitives + redirect the two type-importers**

Copy these files unchanged into the new lib at the same relative paths:
`engine/external-redirect.ts`, `ui/flow-shell.ts`, `ui/step-indicator.ts`, `ui/error-banner.ts` (+spec), `ui/field-error.ts` (+spec), `ui/ui.css`.

Copy `engine/flow-backend.ts` (+spec) and `engine/schema-helpers.ts` (+spec), changing only the type-import path `./flow-def` → `./flow-types`:
- `flow-backend.ts`: `import type { FeatureMap, FlowEnvelope, Signature, SubmitOutcome, TermsMap } from './flow-types';`
- `schema-helpers.ts`: `import type { FeatureDescriptor } from './flow-types';`
- update the same `./flow-def` → `./flow-types` in `flow-backend.spec.ts` / `schema-helpers.spec.ts` if present.

- [ ] **Step 4: Copy `mitid.ts` with the return-path edit**

Copy `engine/mitid.ts` (+spec). Change `buildReturnUrl` to point at the v2 route:
```ts
export function buildReturnUrl(origin: string, flowSlug: string): string {
  const u = new URL('/flow-compose', origin);   // was '/flow-forge'
  u.searchParams.set('mitid', 'callback');
  u.searchParams.set('flow', flowSlug);
  return u.toString();
}
```
In `mitid.spec.ts`, update any `'/flow-forge'` expectation to `'/flow-compose'`.

- [ ] **Step 5: Copy `flow-state-store.ts` with the KEY edit**

Copy `engine/flow-state-store.ts` (+spec). Change the storage key:
```ts
const KEY = 'flow-compose:snapshot';   // was 'flow-forge:snapshot'
```
In `flow-state-store.spec.ts`, update any `'flow-forge:snapshot'` string to `'flow-compose:snapshot'`.

- [ ] **Step 6: Copy `wizard.ts` and remove `phase`** (it lifts onto the runner)

Copy `engine/wizard.ts`, then apply exactly these edits:

1. Delete the `Phase` type and the `phase` field from the `Wizard` interface:
```ts
// DELETE: export type Phase = 'intro' | 'form' | 'done';
// In interface Wizard, DELETE: readonly phase: WritableSignal<Phase>;
```
2. In `createWizard`, delete `const phase = signal<Phase>('intro');`.
3. Rewrite `back()` to only decrement (the runner handles "back from step 0 → intro"):
```ts
const back = (): void => {
  if (!isFirst()) stepIndex.update((i) => i - 1);
};
```
4. Rewrite `reset()` to drop the phase line:
```ts
const reset = (): void => {
  stepIndex.set(0);
  gate.set(Object.fromEntries(steps.map((s) => [s.key, null])));
};
```
5. In the returned object, delete the `phase,` property.
6. `WritableSignal` may now be an unused import — remove it if so.

- [ ] **Step 7: Update `wizard.spec.ts` for the removed phase**

Copy `engine/wizard.spec.ts`, then:
- In "starts on intro…": rename to `'starts on step 0, not attempted'` and delete the line `expect(w.phase()).toBe('intro');`.
- Delete every `w.phase.set('form');` line (the wizard methods work regardless of phase).
- Replace the `back()` test body with (no phase now):
```ts
it('back() decrements; at step 0 it is a no-op (runner owns the intro transition)', () => {
  const w = createWizard(STEPS);
  w.stepIndex.set(1);
  w.back();
  expect(w.stepIndex()).toBe(0);
  w.back();
  expect(w.stepIndex()).toBe(0);
});
```
- In the `reset()` test, delete `expect(w.phase()).toBe('intro');` (keep the stepIndex/attempted assertions).

- [ ] **Step 8: Run the copied specs**

Run: `pnpm nx test tommy-signal-forms-flow-compose`
Expected: `flow-backend.spec`, `schema-helpers.spec`, `error-banner.spec`, `field-error.spec`, `mitid.spec`, `flow-state-store.spec`, `wizard.spec` all pass. (`flow-types.ts` exists from Step 3, so `flow-backend`/`schema-helpers` compile cleanly.)

- [ ] **Step 9: Commit**

```bash
git add libs/tommy/signal-forms/flow-compose tsconfig.base.json
git commit -m "feat(flow-compose): scaffold lib + copy unchanged engine/ui primitives (wizard phase removed)"
```

---

### Task 2: The contract surface — types, config, FlowStep, the two slots

**Goal:** Replace `StepDef`/`defineStep`/`StepComponent`/`FlowDef` with `flow-types.ts` (trimmed), `FlowConfig`, the `FlowStep` structural directive, and the `FlowIntro`/`FlowReceipt` slot directives.

**Files:**
- Create: `src/lib/engine/flow-config.ts`, `src/lib/engine/flow-step.ts`, `src/lib/engine/flow-slots.ts`
- Test: `src/lib/engine/flow-step.spec.ts`, `src/lib/engine/flow-slots.spec.ts`
- Precondition: `src/lib/engine/flow-types.ts` already exists (created in Task 1)

**Acceptance Criteria:**
- [ ] `flow-types.ts` (from Task 1) exports `FlowMeta` (no `intro`), the envelope types, `ServerFieldError`, `Signature`, `SubmitOk`, `SubmitOutcome` — and NO `StepDef`/`defineStep`/`StepComponent`/`FlowDef`/`FlowForm`/`AnyFlowDef`
- [ ] `FlowStep` aliases `flowStep`/`flowStepKey`/`flowStepLabel` and its `ngTemplateContextGuard` reflects `FieldTree<S>`
- [ ] `FlowIntro` (no context) and `FlowReceipt` (context `{ $implicit: SubmitOk }`) select `ng-template[flowIntro]` / `ng-template[flowReceipt]`
- [ ] `flow-step.spec` + `flow-slots.spec` pass

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern="flow-step|flow-slots"` → pass.

**Steps:**

- [ ] **Step 1: Confirm `flow-types.ts` exists** (created in Task 1)

`src/lib/engine/flow-types.ts` was created in Task 1, Step 3. Confirm it exports `FlowMeta` (no `intro`), `FlowEnvelope`/`FeatureMap`/`FeatureDescriptor`/`TermsMap`/`TermDescriptor`, `ServerFieldError`, `Signature`, `SubmitOk`, `SubmitOutcome`. If any are missing, add them (see Task 1, Step 3 for the exact contents). Do NOT recreate the file.

- [ ] **Step 2: Write `flow-config.ts`**

```ts
import type { FieldTree } from '@angular/forms/signals';
import type { FlowMeta, ServerFieldError } from './flow-types';

/**
 * A flow's behavior-free configuration. The engine no longer interprets `buildForm`
 * or a `steps[]` array — those are the flow component's template now. `snapshot` is
 * read by the runner (on 202); `restore` is read by the flow component (on resume).
 */
export interface FlowConfig<Model> {
  readonly meta: FlowMeta;
  readonly schemaVersion: number;
  toSubmission(model: Model): unknown;
  mapServerError?(
    e: ServerFieldError,
    form: FieldTree<Model>,
  ): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;
  restore?(raw: unknown): Model;
}
```

- [ ] **Step 3: Write `flow-step.ts`**

```ts
import { Directive, TemplateRef, inject, input } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

export interface FlowStepContext<S> {
  $implicit: FieldTree<S>;
  showErrors: boolean;
}

/**
 * Declares one step of a flow. The field slice IS the directive's main input, so the
 * runner can gate that subtree; the context guard reflects its type into the template
 * so the author's `let-field` is strongly typed.
 */
@Directive({ selector: 'ng-template[flowStep]' })
export class FlowStep<S = unknown> {
  readonly field = input.required<FieldTree<S>>({ alias: 'flowStep' });
  readonly key = input.required<string>({ alias: 'flowStepKey' });
  readonly label = input.required<string>({ alias: 'flowStepLabel' });
  readonly template = inject<TemplateRef<FlowStepContext<S>>>(TemplateRef);

  static ngTemplateContextGuard<S>(
    _dir: FlowStep<S>,
    ctx: unknown,
  ): ctx is FlowStepContext<S> {
    return true;
  }
}
```

- [ ] **Step 4: Write `flow-slots.ts`** (no FlowError — error is runner-owned)

```ts
import { Directive, TemplateRef, inject } from '@angular/core';
import type { SubmitOk } from './flow-types';

/** Intro body. No context — it is defined in the flow's own template and closes over env(). */
@Directive({ selector: 'ng-template[flowIntro]' })
export class FlowIntro {
  readonly template = inject(TemplateRef);
}

export interface FlowReceiptContext {
  $implicit: SubmitOk;
}

/** Receipt body. Receives the captured ok outcome (incl. confirmationId). */
@Directive({ selector: 'ng-template[flowReceipt]' })
export class FlowReceipt {
  readonly template = inject<TemplateRef<FlowReceiptContext>>(TemplateRef);
  static ngTemplateContextGuard(
    _dir: FlowReceipt,
    ctx: unknown,
  ): ctx is FlowReceiptContext {
    return true;
  }
}
```

- [ ] **Step 5: Write the failing `flow-step.spec.ts`**

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, type FieldTree } from '@angular/forms/signals';
import { NgTemplateOutlet } from '@angular/common';
import { contentChildren } from '@angular/core';
import { FlowStep } from './flow-step';

interface M { a: { x: string }; }

@Component({
  selector: 'tommy-fs-host',
  imports: [FlowStep, NgTemplateOutlet],
  template: `
    <ng-template [flowStep]="f.a" flowStepKey="a" flowStepLabel="A" let-field>
      <span id="val">{{ field().value().x }}</span>
    </ng-template>
    <ng-container [ngTemplateOutlet]="steps()[0].template"
                  [ngTemplateOutletContext]="{ $implicit: f.a, showErrors: false }" />
  `,
})
class FsHost {
  readonly steps = contentChildren(FlowStep);
  readonly model = signal<M>({ a: { x: 'hi' } });
  readonly f: FieldTree<M> = form(this.model);
}

describe('FlowStep', () => {
  it('exposes key/label/field via aliases and renders the slice through its template', () => {
    const fixture = TestBed.createComponent(FsHost);
    fixture.detectChanges();
    const steps = fixture.componentInstance.steps();
    expect(steps.length).toBe(1);
    expect(steps[0].key()).toBe('a');
    expect(steps[0].label()).toBe('A');
    expect((fixture.nativeElement as HTMLElement).querySelector('#val')?.textContent).toBe('hi');
  });
});
```
Note: `contentChildren(FlowStep)` on a component querying its OWN template content requires the `ng-template` to be projected content; if the query returns empty under this self-host arrangement, move the `<ng-template>` into a wrapper `<tommy-fs-runner>` child that does the query. Prefer the simplest arrangement that makes the query non-empty.

- [ ] **Step 6: Run it red, then green**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-step`
Expected first run: FAIL (e.g. assertion or query-empty). Adjust the host arrangement per the note until it passes.

- [ ] **Step 7: Write `flow-slots.spec.ts`**

```ts
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgTemplateOutlet } from '@angular/common';
import { contentChild } from '@angular/core';
import { FlowIntro, FlowReceipt } from './flow-slots';
import type { SubmitOk } from './flow-types';

@Component({
  selector: 'tommy-slot-host',
  imports: [FlowIntro, FlowReceipt, NgTemplateOutlet],
  template: `
    <ng-template flowIntro><span id="intro">hello</span></ng-template>
    <ng-template flowReceipt let-r><span id="rcpt">{{ r.confirmationId }}</span></ng-template>
    <ng-container [ngTemplateOutlet]="intro()!.template" />
    <ng-container [ngTemplateOutlet]="receipt()!.template"
                  [ngTemplateOutletContext]="{ $implicit: ok }" />
  `,
})
class SlotHost {
  readonly intro = contentChild(FlowIntro);
  readonly receipt = contentChild(FlowReceipt);
  readonly ok: SubmitOk = { status: 'ok', httpStatus: 200, confirmationId: 'OK-1' };
}

describe('Flow slots', () => {
  it('projects intro body and receipt body with the ok outcome', () => {
    const fixture = TestBed.createComponent(SlotHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#intro')?.textContent).toBe('hello');
    expect(el.querySelector('#rcpt')?.textContent).toBe('OK-1');
  });
});
```

- [ ] **Step 8: Run the slot spec, then commit**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern="flow-step|flow-slots"` → PASS.
```bash
git add libs/tommy/signal-forms/flow-compose/src/lib/engine
git commit -m "feat(flow-compose): contract surface — flow-types, FlowConfig, FlowStep, intro/receipt slots"
```

---

### Task 3: The FlowRunner shell + test host + ported runner spec

**Goal:** Rewrite the runner as a content-querying shell owning the `intro|form|done|error` phase machine, standardized footers, the lazy wizard, the submit state machine, and the resume re-submit — driven in tests by a content-projecting test host.

**Files:**
- Create: `src/lib/engine/flow-runner.ts`, `src/lib/engine/flow-runner.html`, `src/lib/engine/testing/test-host.ts`, `src/lib/engine/flow-runner.spec.ts`

**Acceptance Criteria:**
- [ ] Phases render the right body+footer: intro→`flowIntro` + Start (disabled until `form()`); form→active step via `ngTemplateOutlet` + Back/Next/Submit; done→`flowReceipt(SubmitOk)` + Start over; error→built-in body + Try again
- [ ] Gate blocks Next on an invalid step; 200→done; 422→inline banner (stays in form, not terminal); 202→snapshot + same-origin redirect
- [ ] `loadError` set → error page kind `load`, Try-again emits `(retry)` + returns to intro; an unexpected submit exception → error page kind `submit`, Try-again returns to form
- [ ] Resume: with `[resume]` signature set and form+steps ready, the runner jumps to the last step and re-submits → done

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-runner` → pass.

**Steps:**

- [ ] **Step 1: Write `flow-runner.ts`**

```ts
import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed,
  contentChild, contentChildren, effect, inject, input, output, signal, untracked, viewChild,
} from '@angular/core';
import { submit, type FieldTree } from '@angular/forms/signals';
import type { FlowConfig } from './flow-config';
import type { ServerFieldError, Signature, SubmitOk, SubmitOutcome } from './flow-types';
import { FlowStep } from './flow-step';
import { FlowIntro, FlowReceipt } from './flow-slots';
import { FlowBackend } from './flow-backend';
import { ExternalRedirect } from './external-redirect';
import { FlowStateStore } from './flow-state-store';
import { buildReturnUrl } from './mitid';
import { createWizard, type StepState, type Wizard } from './wizard';
import { FlowShell } from '../ui/flow-shell';
import { StepIndicator } from '../ui/step-indicator';
import { ErrorBanner } from '../ui/error-banner';

declare const ngDevMode: boolean | undefined;

type Phase = 'intro' | 'form' | 'done' | 'error';
interface ErrorInfo { kind: 'load' | 'submit'; message: string; }

@Component({
  selector: 'tommy-flow-runner',
  imports: [NgTemplateOutlet, FlowShell, StepIndicator, ErrorBanner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-runner.html',
})
export class FlowRunner {
  private readonly backend = inject(FlowBackend);
  private readonly redirect = inject(ExternalRedirect);
  private readonly store = inject(FlowStateStore);
  private readonly injector = inject(Injector);

  readonly config = input.required<FlowConfig<unknown>>();
  readonly form = input<FieldTree<unknown>>();
  readonly loadError = input<string | null>(null);
  readonly resume = input<Signature | null>(null);
  readonly retry = output<void>();

  protected readonly steps = contentChildren(FlowStep);
  protected readonly introTpl = contentChild.required(FlowIntro);
  protected readonly receiptTpl = contentChild.required(FlowReceipt);

  protected readonly phase = signal<Phase>('intro');
  protected readonly errorInfo = signal<ErrorInfo | null>(null);
  protected readonly result = signal<SubmitOk | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly submitting = signal(false);

  /** During a MitID resume, show the "completing signing" screen (mirrors v1). */
  protected readonly resuming = computed(
    () => !!this.resume() && this.phase() !== 'done' && this.phase() !== 'error',
  );

  private readonly stepRegion = viewChild<ElementRef<HTMLElement>>('stepRegion');
  private resumeFired = false;
  private wizard: Wizard | null = null;

  /** Build ONCE on first form-entry, from the settled (post-load) step set. */
  private ensureWizard(): Wizard {
    return (this.wizard ??= createWizard(
      this.steps().map((s) => ({ key: s.key(), label: s.label() })),
    ));
  }
  protected w(): Wizard { return this.ensureWizard(); }

  protected readonly activeStep = computed(() => this.steps()[this.ensureWizard().stepIndex()]);
  protected readonly stepContext = computed(() => ({
    $implicit: this.activeStep().field(),
    showErrors: this.ensureWizard().attempted(),
  }));

  constructor() {
    // A load failure (reported by the flow via [loadError]) is terminal.
    effect(() => {
      const msg = this.loadError();
      if (msg && this.phase() === 'intro') {
        this.errorInfo.set({ kind: 'load', message: msg });
        this.phase.set('error');
      }
    });

    // MitID resume: once form + steps are ready, jump to the last step and re-submit.
    effect(() => {
      const sig = this.resume();
      const f = this.form();
      const ready = this.steps().length > 0;
      if (!sig || !f || !ready || this.resumeFired) return;
      this.resumeFired = true;
      untracked(() => {
        this.phase.set('form');
        const w = this.ensureWizard();
        w.stepIndex.set(this.steps().length - 1);
        void this.onSubmit(sig);
      });
    });

    // Focus the step region on step change (a11y); zoneless-safe via afterNextRender.
    effect(() => {
      if (this.phase() !== 'form' || this.resuming()) return;
      this.wizard?.stepIndex();
      afterNextRender(() => this.stepRegion()?.nativeElement.focus(), { injector: this.injector });
    });
  }

  start(): void {
    this.phase.set('form');
    this.ensureWizard().stepIndex.set(0);
  }

  next(): void {
    this.submitError.set(null);
    const state = this.currentStepState();
    if (state) this.ensureWizard().next(state);
  }

  back(): void {
    this.submitError.set(null);
    const w = this.ensureWizard();
    if (w.isFirst()) this.phase.set('intro');
    else w.back();
  }

  async onSubmit(signature?: Signature): Promise<void> {
    const form = this.form();
    if (!form) return;
    const w = this.ensureWizard();
    const state = this.currentStepState();
    if (!state || !w.validateCurrent(state)) return;

    this.submitError.set(null);
    this.result.set(null);
    this.submitting.set(true);

    const settled: { outcome: SubmitOutcome | null } = { outcome: null };
    try {
      await submit(form, {
        action: async (field) => {
          const payload = this.config().toSubmission(field().value());
          const outcome = await this.backend.submit(this.config().meta.slug, payload, signature);
          settled.outcome = outcome;
          if (outcome.status === 'ok') {
            this.result.set(outcome);
            return null;
          }
          if (outcome.status === 'signing_required') {
            this.beginSigning(outcome.challengeId, outcome.signingUrl, form);
            return null; // page is about to unload
          }
          return outcome.errors.map((e) => this.toServerError(e, form));
        },
      });
    } catch (e) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode) console.error('[flow-compose] submit failed', e);
      this.errorInfo.set({ kind: 'submit', message: 'An unexpected error occurred. Please try again.' });
      this.phase.set('error');
      return;
    } finally {
      this.submitting.set(false);
    }

    const outcome = settled.outcome;
    if (outcome?.status === 'ok') { this.phase.set('done'); return; }
    if (outcome?.status === 'rejected') this.placeRejection(outcome.errors, form);
  }

  tryAgain(): void {
    const info = this.errorInfo();
    this.errorInfo.set(null);
    if (info?.kind === 'load') {
      this.phase.set('intro');
      this.retry.emit();
    } else {
      this.phase.set('form'); // submit failure → back to the (last) step to retry
    }
  }

  reset(): void {
    this.phase.set('intro');
    this.result.set(null);
    this.errorInfo.set(null);
    this.submitError.set(null);
    this.submitting.set(false);
    this.resumeFired = false;
    this.wizard?.reset();
  }

  private currentStepState(): StepState | null {
    const step = this.activeStep();
    return step ? adaptState(step.field()) : null;
  }

  private toServerError(e: ServerFieldError, form: FieldTree<unknown>) {
    const mapped = this.config().mapServerError?.(e, form);
    return { kind: 'server' as const, message: e.message, fieldTree: mapped?.fieldTree ?? form };
  }

  private placeRejection(errors: readonly ServerFieldError[], form: FieldTree<unknown>): void {
    const config = this.config();
    const first = errors[0];
    const mapped = first ? config.mapServerError?.(first, form) : undefined;
    const stepKey = mapped?.stepKey ?? this.steps()[0].key();
    const node = (mapped?.fieldTree ?? form) as FieldTree<unknown>;
    node().reset();
    this.ensureWizard().freezeBanner(stepKey, [...new Set(errors.map((e) => e.message))]);
  }

  private beginSigning(challengeId: string, signingUrl: string, form: FieldTree<unknown>): void {
    const config = this.config();
    const state = crypto.randomUUID();
    const value = form().value();
    const model = config.snapshot ? config.snapshot(value) : JSON.parse(JSON.stringify(value));
    this.store.save({ flowSlug: config.meta.slug, schemaVersion: config.schemaVersion, state, challengeId, model });
    const returnUrl = buildReturnUrl(this.redirect.origin, config.meta.slug);
    const u = new URL(signingUrl);
    u.searchParams.set('state', state);
    u.searchParams.set('return', returnUrl);
    this.redirect.to(u.toString());
  }
}

/** Adapt a signal-forms FieldTree node to the wizard's StepState interface. */
function adaptState(node: FieldTree<unknown>): StepState {
  const s = node();
  return { valid: () => s.valid(), errorSummary: () => s.errorSummary(), reset: () => s.reset() };
}
```

- [ ] **Step 2: Write `flow-runner.html`**

```html
@if (resuming()) {
  <tommy-flow-shell>
    <h2 class="ui-title">Completing your MitID signing…</h2>
    <p class="ui-muted"><span class="ui-spinner" aria-hidden="true"></span> Verifying your signature.</p>
  </tommy-flow-shell>
} @else {
  <tommy-flow-shell>
    @switch (phase()) {

      @case ('intro') {
        <ng-container [ngTemplateOutlet]="introTpl().template" />
        <div class="ui-foot">
          <button type="button" class="ui-btn ui-btn-primary" [disabled]="!form()" [attr.aria-busy]="!form()" (click)="start()">
            @if (!form()) { <span class="ui-spinner" aria-hidden="true"></span> Loading… } @else { Start }
          </button>
        </div>
      }

      @case ('form') {
        @let wiz = w();
        <tommy-step-indicator [labels]="wiz.labels" [activeIndex]="wiz.stepIndex()" />
        <tommy-error-banner [messages]="wiz.bannerMessages()" />
        <div #stepRegion tabindex="-1" class="ui-stack">
          <ng-container [ngTemplateOutlet]="activeStep().template" [ngTemplateOutletContext]="stepContext()" />
        </div>
        @if (submitError()) { <p class="ui-error">{{ submitError() }}</p> }
        <div class="ui-row ui-foot">
          <button type="button" class="ui-btn" (click)="back()">Back</button>
          @if (wiz.isLast()) {
            <button type="button" class="ui-btn ui-btn-primary" [disabled]="submitting()" [attr.aria-busy]="submitting()" (click)="onSubmit()">
              @if (submitting()) { <span class="ui-spinner" aria-hidden="true"></span> Submitting… } @else { Submit }
            </button>
          } @else {
            <button type="button" class="ui-btn ui-btn-primary" (click)="next()">Next</button>
          }
        </div>
      }

      @case ('done') {
        @if (result(); as r) {
          <ng-container [ngTemplateOutlet]="receiptTpl().template" [ngTemplateOutletContext]="{ $implicit: r }" />
        }
        <div class="ui-foot">
          <button type="button" class="ui-btn" (click)="reset()">Start over</button>
        </div>
      }

      @case ('error') {
        <h2 class="ui-title">We couldn't complete this</h2>
        <p class="ui-error">{{ errorInfo()?.message }}</p>
        <div class="ui-foot">
          <button type="button" class="ui-btn ui-btn-primary" (click)="tryAgain()">Try again</button>
        </div>
      }
    }
  </tommy-flow-shell>
}
```

- [ ] **Step 3: Write `testing/test-host.ts`** (plays the flow-component role for runner tests)

```ts
import { ChangeDetectionStrategy, Component, Injector, computed, inject, signal } from '@angular/core';
import { FormField, form, required, schema, type FieldTree } from '@angular/forms/signals';
import type { Signature } from '../flow-types';
import type { FlowConfig } from '../flow-config';
import { FlowRunner } from '../flow-runner';
import { FlowStep } from '../flow-step';
import { FlowIntro, FlowReceipt } from '../flow-slots';

export interface TestModel { one: { name: string }; two: { city: string }; }

export const TEST_CONFIG: FlowConfig<TestModel> = {
  meta: { slug: 'test', title: 'Test Flow', blurb: 'b', dimension: 'minimal' },
  schemaVersion: 1,
  toSubmission: (m) => m,
};

const TEST_SCHEMA = schema<TestModel>((p) => {
  required(p.one.name, { message: 'Name required' });
  required(p.two.city, { message: 'City required' });
});

@Component({
  selector: 'tommy-test-host',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tommy-flow-runner [config]="config" [form]="form()" [loadError]="loadError()"
                       [resume]="resume()" (retry)="retried.set(true)">
      <ng-template flowIntro><h2 class="ui-title">Test Flow</h2><p class="ui-muted">intro copy</p></ng-template>

      @if (form(); as form) {
        <ng-template [flowStep]="form.one" flowStepKey="one" flowStepLabel="One" let-field let-showErrors="showErrors">
          <input [formField]="field().name" id="t-name" />
        </ng-template>
        <ng-template [flowStep]="form.two" flowStepKey="two" flowStepLabel="Two" let-field let-showErrors="showErrors">
          <input [formField]="field().city" id="t-city" />
        </ng-template>
      }

      <ng-template flowReceipt let-result><p id="rcpt">All set — {{ result.confirmationId }}</p></ng-template>
    </tommy-flow-runner>
  `,
})
export class TestHost {
  private readonly injector = inject(Injector);
  readonly config = TEST_CONFIG;
  readonly model = signal<TestModel>({ one: { name: '' }, two: { city: '' } });
  /** form() returns undefined until `formReady` is true (simulates env loading). */
  readonly formReady = signal(true);
  private readonly builtForm: FieldTree<TestModel> = form(this.model, TEST_SCHEMA);
  readonly form = computed(() => (this.formReady() ? this.builtForm : undefined));
  readonly loadError = signal<string | null>(null);
  readonly resume = signal<Signature | null>(null);
  readonly retried = signal(false);
}
```
Note: `form(this.model, TEST_SCHEMA)` runs in the field initializer (an injection context), so no `runInInjectionContext` needed. If the runtime complains about injection context, wrap it: `runInInjectionContext(this.injector, () => form(this.model, TEST_SCHEMA))`.

- [ ] **Step 4: Write `flow-runner.spec.ts`**

Reuse the driving helpers from v1's `flow-runner.spec.ts` (`start`, `setInput`, `clickButton`, `clickSubmit`) but target the `TestHost` element. The fixtures map keys slug `'test'`.

```ts
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { TestHost } from './testing/test-host';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';
import { ExternalRedirect } from './external-redirect';
import { FlowStateStore } from './flow-state-store';
import type { SubmitOutcome } from './flow-types';

class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'https://lab.example';
  to(url: string): void { this.lastUrl = url; }
}

function configure(submit: FlowFixture['submit'], redirect = new FakeRedirect()) {
  TestBed.configureTestingModule({
    imports: [TestHost],
    providers: [
      FlowBackend, FlowStateStore,
      { provide: ExternalRedirect, useValue: redirect },
      { provide: FLOW_FIXTURES, useValue: new Map<string, FlowFixture>([['test', { features: {}, terms: {}, submit }]]) },
    ],
  });
  const fixture = TestBed.createComponent(TestHost);
  fixture.detectChanges();
  return { fixture, redirect };
}

const OK: FlowFixture['submit'] = () => ({ status: 'ok', httpStatus: 200, confirmationId: 'OK-9' } as const);

function clickByText(fixture: ComponentFixture<TestHost>, text: string): void {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text || (b.textContent ?? '').includes(text));
  if (!btn) throw new Error(`button not found: ${text}`);
  btn.click();
  fixture.detectChanges();
}
function setInput(fixture: ComponentFixture<TestHost>, selector: string, value: string): void {
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}
async function clickSubmit(fixture: ComponentFixture<TestHost>): Promise<void> {
  clickByText(fixture, 'Submit');
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('FlowRunner — phases & gate', () => {
  afterEach(() => sessionStorage.clear());

  it('renders the flowIntro body in the intro phase', () => {
    const { fixture } = configure(OK);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('intro copy');
  });

  it('Start (form ready) shows the first step; Start is disabled while form is undefined', () => {
    const { fixture } = configure(OK);
    fixture.componentInstance.formReady.set(false);
    fixture.detectChanges();
    const start = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(start?.hasAttribute('disabled')).toBe(true);
    fixture.componentInstance.formReady.set(true);
    fixture.detectChanges();
    clickByText(fixture, 'Start');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-name')).not.toBeNull();
  });

  it('Next advances when valid; Back returns; Next blocks when invalid', () => {
    const { fixture } = configure(OK);
    clickByText(fixture, 'Start');
    // invalid → blocked
    clickByText(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-name')).not.toBeNull();
    // valid → advance
    setInput(fixture, '#t-name', 'Tommy');
    clickByText(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-city')).not.toBeNull();
    clickByText(fixture, 'Back');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-name')).not.toBeNull();
  });
});

describe('FlowRunner — submit outcomes', () => {
  afterEach(() => sessionStorage.clear());

  async function fillToLast(fixture: ComponentFixture<TestHost>) {
    clickByText(fixture, 'Start');
    setInput(fixture, '#t-name', 'Tommy');
    clickByText(fixture, 'Next');
    setInput(fixture, '#t-city', 'CPH');
  }

  it('200 → done renders the flowReceipt with the confirmation id', async () => {
    const { fixture } = configure(OK);
    await fillToLast(fixture);
    await clickSubmit(fixture);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('All set — OK-9');
  });

  it('422 → inline banner, stays in form (NOT the error page)', async () => {
    const { fixture } = configure(() => ({ status: 'rejected', httpStatus: 422, errors: [{ field: 'x', message: 'Name taken' }] } as const));
    await fillToLast(fixture);
    await clickSubmit(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Name taken');
    expect(el.textContent).not.toContain("We couldn't complete this");
    expect(el.querySelector('#t-city')).not.toBeNull(); // still on the form
  });

  it('202 → saves snapshot + redirects same-origin', async () => {
    const { fixture, redirect } = configure(() => ({ status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/sign?c=1', challengeId: 'ch-1' } as const));
    await fillToLast(fixture);
    await clickSubmit(fixture);
    const url = new URL(redirect.lastUrl as string);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('return')).toContain(redirect.origin);
    expect(sessionStorage.getItem('flow-compose:snapshot')).not.toBeNull();
  });
});

describe('FlowRunner — error page', () => {
  afterEach(() => sessionStorage.clear());

  it('loadError → error page (kind load); Try again emits retry + returns to intro', () => {
    const { fixture } = configure(OK);
    fixture.componentInstance.loadError.set('Could not start this flow. Please retry.');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("We couldn't complete this");
    expect(el.textContent).toContain('Could not start this flow');
    clickByText(fixture, 'Try again');
    expect(fixture.componentInstance.retried()).toBe(true);
    expect(el.textContent).toContain('intro copy'); // back on intro
  });

  it('unexpected submit error → error page (kind submit); Try again returns to the form', async () => {
    const { fixture } = configure(() => { throw new Error('boom'); });
    clickByText(fixture, 'Start');
    setInput(fixture, '#t-name', 'Tommy');
    clickByText(fixture, 'Next');
    setInput(fixture, '#t-city', 'CPH');
    await clickSubmit(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("We couldn't complete this");
    clickByText(fixture, 'Try again');
    expect(el.querySelector('#t-city')).not.toBeNull(); // back on the form
  });
});

describe('FlowRunner — resume', () => {
  afterEach(() => sessionStorage.clear());

  it('with [resume] set + form ready, jumps to the last step and re-submits → done', async () => {
    const submit: FlowFixture['submit'] = (_p, sig) =>
      sig ? ({ status: 'ok', httpStatus: 200, confirmationId: 'SIGNED-1' } as const)
          : ({ status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/x', challengeId: 'c' } as const);
    const { fixture } = configure(submit);
    fixture.componentInstance.resume.set({ challengeId: 'c', code: 'otc-1' });
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 700)); // submit(500) real delay
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('All set — SIGNED-1');
  });
});
```

- [ ] **Step 5: Run, fix, commit**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-runner`
Expected: all pass. If `contentChild.required(FlowIntro)` throws "No provider"/"required content child not found", confirm the slots are NOT inside `@if` in the host (they must be unconditionally projected). If the 202 redirect URL test fails because the snapshot key is wrong, recheck Task 1 Step 5.
```bash
git add libs/tommy/signal-forms/flow-compose/src/lib/engine
git commit -m "feat(flow-compose): FlowRunner shell (phase machine, slots, submit, resume) + test host"
```

---

### Task 4: The FlowResume single-read service

**Goal:** One in-memory reader fronting the single-use MitID snapshot, with two consumers (flow restores model; runner re-submits signature) and the launcher boot entry point.

**Files:**
- Create: `src/lib/engine/resume.ts`, `src/lib/engine/flow-resume.ts`, `src/lib/engine/flow-resume.spec.ts`

**Acceptance Criteria:**
- [ ] `consume(queryMap, versionFor)` is the sole `parseCallback` + `store.restore` caller; validates state nonce + schema version; returns the slug to auto-select (or null)
- [ ] `pending(slug)` is multi-read in memory (two reads return the same data); only for an `approved` callback
- [ ] `cancelledNotice(slug)` true only after a valid `cancelled` callback
- [ ] Replay/mismatched-state/absent-snapshot/no-callback all yield `consume → null` and `pending → null`

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-resume` → pass.

**Steps:**

- [ ] **Step 1: Write `resume.ts`** (the pending-resume DTO)

```ts
import type { Signature } from './flow-types';

/** What the flow component + runner consult after a MitID round-trip. */
export interface PendingResume {
  /** The serialized model from the single-use snapshot (already `config.snapshot`-shaped). */
  readonly model: unknown;
  /** The MitID proof: challenge id + the one-time code returned by the provider. */
  readonly signature: Signature;
}
```

- [ ] **Step 2: Write `flow-resume.ts`**

```ts
import { Injectable, inject } from '@angular/core';
import { FlowStateStore } from './flow-state-store';
import { parseCallback } from './mitid';
import type { PendingResume } from './resume';

interface Cached {
  readonly slug: string;
  readonly status: 'approved' | 'cancelled';
  readonly pending: PendingResume | null;
}

/**
 * Single-read front for the single-use MitID snapshot. The launcher calls `consume`
 * once on boot; the flow component and runner then read the cached result freely (the
 * replay risk lived in sessionStorage — once validated into memory it is plain state).
 */
@Injectable({ providedIn: 'root' })
export class FlowResume {
  private readonly store = inject(FlowStateStore);
  private cached: Cached | null = null;
  private consumed = false;

  /**
   * The sole `parseCallback` + `store.restore` reader. `versionFor` maps a slug to its
   * `schemaVersion` (the launcher supplies it from the flow configs). Returns the slug
   * to auto-select, or null when there is no valid callback to resume.
   */
  consume(
    q: { get(key: string): string | null },
    versionFor: (slug: string) => number | undefined,
  ): string | null {
    if (this.consumed) return this.cached?.slug ?? null;
    this.consumed = true;

    const cb = parseCallback(q);
    if (cb.mitid !== 'callback' || !cb.flow) return null;

    const version = versionFor(cb.flow);
    if (version === undefined) return null;

    const snap = this.store.restore(cb.flow, version); // single-use
    if (!snap || !cb.state || snap.state !== cb.state) return null; // correlation / replay

    if (cb.status === 'approved' && cb.code) {
      this.cached = {
        slug: cb.flow,
        status: 'approved',
        pending: { model: snap.model, signature: { challengeId: snap.challengeId, code: cb.code } },
      };
    } else {
      this.cached = { slug: cb.flow, status: 'cancelled', pending: null };
    }
    return cb.flow;
  }

  /** In-memory, multi-read. The pending resume for a slug (approved only). */
  pending(slug: string): PendingResume | null {
    return this.cached?.slug === slug && this.cached.status === 'approved'
      ? this.cached.pending
      : null;
  }

  /** True only after a valid `cancelled` callback for this slug. */
  cancelledNotice(slug: string): boolean {
    return this.cached?.slug === slug && this.cached.status === 'cancelled';
  }
}
```

- [ ] **Step 3: Write `flow-resume.spec.ts`**

```ts
import { TestBed } from '@angular/core/testing';
import { FlowResume } from './flow-resume';
import { FlowStateStore } from './flow-state-store';

function qmap(params: Record<string, string>) {
  return { get: (k: string) => params[k] ?? null };
}
const VERSION = () => 1;

function saveSnapshot(state: string) {
  TestBed.inject(FlowStateStore).save({
    flowSlug: 'bank', schemaVersion: 1, state, challengeId: 'ch-1', model: { a: 1 },
  });
}

describe('FlowResume', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FlowResume, FlowStateStore] });
    sessionStorage.clear();
  });
  afterEach(() => sessionStorage.clear());

  it('approved callback with matching state → slug + pending (multi-read)', () => {
    saveSnapshot('st-1');
    const r = TestBed.inject(FlowResume);
    const slug = r.consume(qmap({ mitid: 'callback', flow: 'bank', status: 'approved', state: 'st-1', code: 'otc' }), VERSION);
    expect(slug).toBe('bank');
    const a = r.pending('bank');
    const b = r.pending('bank');
    expect(a).toEqual({ model: { a: 1 }, signature: { challengeId: 'ch-1', code: 'otc' } });
    expect(b).toEqual(a); // multi-read
    expect(r.cancelledNotice('bank')).toBe(false);
  });

  it('cancelled callback → slug + cancelledNotice, no pending', () => {
    saveSnapshot('st-2');
    const r = TestBed.inject(FlowResume);
    const slug = r.consume(qmap({ mitid: 'callback', flow: 'bank', status: 'cancelled', state: 'st-2' }), VERSION);
    expect(slug).toBe('bank');
    expect(r.pending('bank')).toBeNull();
    expect(r.cancelledNotice('bank')).toBe(true);
  });

  it('state mismatch (replay) → null, no pending', () => {
    saveSnapshot('st-real');
    const r = TestBed.inject(FlowResume);
    expect(r.consume(qmap({ mitid: 'callback', flow: 'bank', status: 'approved', state: 'st-evil', code: 'x' }), VERSION)).toBeNull();
    expect(r.pending('bank')).toBeNull();
  });

  it('no callback params → null', () => {
    const r = TestBed.inject(FlowResume);
    expect(r.consume(qmap({}), VERSION)).toBeNull();
  });

  it('unknown slug (versionFor undefined) → null', () => {
    saveSnapshot('st-3');
    const r = TestBed.inject(FlowResume);
    expect(r.consume(qmap({ mitid: 'callback', flow: 'ghost', status: 'approved', state: 'st-3', code: 'x' }), () => undefined)).toBeNull();
  });
});
```

- [ ] **Step 4: Run + commit**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-resume` → PASS.
```bash
git add libs/tommy/signal-forms/flow-compose/src/lib/engine
git commit -m "feat(flow-compose): FlowResume single-read service for the MitID round-trip"
```

---

### Task 5: Port the three flows as components

**Goal:** Turn each flow into a component owning `env`/`model`/`form` + declaring its steps and the `flowIntro`/`flowReceipt` slots; copy each flow's model/schema/fixtures/steps with the mechanical refactors; port the bank round-trip integration spec.

**Files (per flow `<name>` ∈ {newsletter, bank, insurance}):**
- Create: `src/lib/flows/<name>/<name>-flow.ts`, `src/lib/flows/<name>/<name>-flow.html`, `src/lib/flows/<name>/<name>-config.ts`, `src/lib/flows/<name>/form.ts`
- Copy with edits: `src/lib/flows/<name>/model.ts`, `schema.ts` (+`schema.spec.ts`), `fixtures.ts` (+`fixtures.spec.ts` where present), `steps/*.ts`
- Copy with edits (shared): `src/lib/steps/tos-step.ts`
- Create: `src/lib/flows/bank/round-trip.spec.ts`

**Acceptance Criteria:**
- [ ] Each flow renders intro → steps → receipt; the model's env-derived `tos[]` is seeded after env resolves; load failure shows the runner's built-in error page
- [ ] `TosStep` takes a `terms` input (no `data`); all step components compile without `implements StepComponent`
- [ ] Bank performs the full 202 → snapshot+redirect → approved-callback → resume → 200 round-trip and lands on its receipt with `BANK-bank-0001`
- [ ] Ported `schema.spec` / `fixtures.spec` pass

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern="flows/"` → pass.

**Steps:**

- [ ] **Step 1: Copy `steps/tos-step.ts` with the `data → terms` refactor**

Copy `src/lib/steps/tos-step.ts`, then:
- Change the import `import type { TermsMap, StepComponent } from '../engine/flow-def';` → `import type { TermsMap } from '../engine/flow-types';`
- Rename the input: `readonly data = input.required<TermsMap>();` → `readonly terms = input.required<TermsMap>();`
- In the template, change `@let terms = data();` → `@let terms = terms();`
- Change the class declaration `export class TosStep implements StepComponent<TosAck[], TermsMap> {` → `export class TosStep {`

- [ ] **Step 2: Copy each flow's step components with the StepComponent removal**

For every file under `flows/<name>/steps/*.ts` (applicant-step, account-type-step, contact-step, prefs-step, policy-step, incident-step, items-step):
- Delete the import line `import type { StepComponent } from '../../../engine/flow-def';`
- Change `export class XStep implements StepComponent<...> {` → `export class XStep {`
- Leave `field` + `showErrors` inputs and the template unchanged.

- [ ] **Step 3: Copy each flow's `schema.ts` (+spec) and `fixtures.ts` (+spec)**

Copy verbatim, changing only the type import path `../../engine/flow-def` → `../../engine/flow-types` (for `FlowEnvelope`, `FeatureDescriptor`, `SubmitOutcome`). `fixtures.ts` imports `FlowFixture` from `../../engine/flow-backend` (unchanged) and `MOCK_IDP_ORIGIN` from `../../engine/mitid` (unchanged). Update any `flow-def` import in `schema.spec.ts`/`fixtures.spec.ts` the same way.

- [ ] **Step 4: Copy each flow's `model.ts` and split `emptyModel(env)`** into an env-free skeleton

For `flows/bank/model.ts` (apply the analogous change to newsletter + insurance):
```ts
import type { TosAck } from '../../steps/tos-step';

export type AccountType = '' | 'standard' | 'student' | 'business';

export interface BankModel {
  applicant: { fullName: string; cpr: string; address: string };
  account: { accountType: AccountType };
  tos: TosAck[];
}

/** Env-free skeleton; the env-derived tos[] is seeded by the flow component on env-resolve. */
export function emptyBankModel(): BankModel {
  return {
    applicant: { fullName: '', cpr: '', address: '' },
    account: { accountType: '' },
    tos: [],
  };
}
```
- newsletter: `emptyNewsletterModel()` → `{ contact: { name: '', email: '' }, prefs: { frequency: 'weekly' }, tos: [] }`
- insurance: `emptyInsuranceModel()` → `{ policy: { policyNumber: '' }, incident: { date: '', description: '', injured: false, injuryDetails: '' }, items: [{ description: '', amount: 0 }], tos: [] }`

(Remove the old `emptyModel(env)` + its `FlowEnvelope`/`tosAcksFrom` imports from `model.ts`; `tosAcksFrom` now lives in the flow component's seeding effect.)

- [ ] **Step 5: Write each flow's `form.ts`** (free form builder)

`flows/bank/form.ts`:
```ts
import { Injector, runInInjectionContext, type WritableSignal } from '@angular/core';
import { form } from '@angular/forms/signals';
import type { FlowEnvelope } from '../../engine/flow-types';
import type { BankModel } from './model';
import { bankSchema } from './schema';

export function bankForm(model: WritableSignal<BankModel>, env: FlowEnvelope, injector: Injector) {
  return runInInjectionContext(injector, () => form(model, bankSchema(env)));
}
```
Analogous `newsletterForm` (uses `newsletterSchema`) and `insuranceForm` (uses `insuranceSchema`).

- [ ] **Step 6: Write each flow's `<name>-config.ts`**

`flows/bank/bank-config.ts`:
```ts
import type { FlowConfig } from '../../engine/flow-config';
import type { BankModel } from './model';

export const BANK_FLOW_CONFIG: FlowConfig<BankModel> = {
  meta: {
    slug: 'bank',
    title: 'Open a bank account',
    blurb: 'Apply, then sign with MitID to finish — the in-context signing flow.',
    dimension: 'signing',
  },
  schemaVersion: 1,
  toSubmission: (m) => ({
    applicant: m.applicant,
    accountType: m.account.accountType,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
```
- `NEWSLETTER_FLOW_CONFIG` (slug `newsletter`, dimension `minimal`, `toSubmission` per v1 newsletter `def.ts`).
- `INSURANCE_FLOW_CONFIG` (slug `insurance`, dimension `complex`, `toSubmission` per v1 insurance `def.ts`: `{ policy, incident, items, acceptedTermIds }`).
(Copy each `meta` title/blurb and `toSubmission` body from the matching v1 `flows/<name>/def.ts`, dropping `meta.intro`.)

- [ ] **Step 7: Write each flow component + template**

`flows/bank/bank-flow.ts`:
```ts
import { ChangeDetectionStrategy, Component, Injector, computed, effect, inject, resource, signal } from '@angular/core';
import { FlowBackend } from '../../engine/flow-backend';
import { FlowResume } from '../../engine/flow-resume';
import { FlowRunner } from '../../engine/flow-runner';
import { FlowStep } from '../../engine/flow-step';
import { FlowIntro, FlowReceipt } from '../../engine/flow-slots';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { ApplicantStep } from './steps/applicant-step';
import { AccountTypeStep } from './steps/account-type-step';
import { BANK_FLOW_CONFIG } from './bank-config';
import { emptyBankModel, type BankModel } from './model';
import { bankForm } from './form';

@Component({
  selector: 'tommy-bank-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, ApplicantStep, AccountTypeStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bank-flow.html',
})
export class BankFlow {
  private readonly injector = inject(Injector);
  private readonly backend = inject(FlowBackend);
  private readonly resume = inject(FlowResume);
  private readonly pending = this.resume.pending('bank');

  protected readonly config = BANK_FLOW_CONFIG;
  protected readonly env = resource({ loader: () => this.backend.loadOptions('bank') });
  protected readonly model = signal<BankModel>(
    this.pending
      ? ((BANK_FLOW_CONFIG.restore?.(this.pending.model) ?? this.pending.model) as BankModel)
      : emptyBankModel(),
  );
  protected readonly form = computed(() =>
    this.env.hasValue() ? bankForm(this.model, this.env.value()!, this.injector) : undefined,
  );
  protected readonly signature = this.pending?.signature ?? null;
  protected readonly loadErrorMsg = computed(() =>
    this.env.error() ? 'Could not start this flow. Please retry.' : null,
  );

  constructor() {
    // Seed env-derived defaults (the tos[] array) once env resolves — NOT when resuming
    // (the restored model already carries the user's tos answers).
    effect(() => {
      if (this.pending || !this.env.hasValue()) return;
      this.model.update((m) => ({ ...m, tos: tosAcksFrom(this.env.value()!.terms) }));
    });
  }
}
```

`flows/bank/bank-flow.html`:
```html
<tommy-flow-runner [config]="config" [form]="form()" [loadError]="loadErrorMsg()"
                   [resume]="signature" (retry)="env.reload()">

  <ng-template flowIntro>
    <h2 class="ui-title">Open a bank account</h2>
    <p class="ui-muted">Open a new account. You will confirm with MitID before we create it.</p>
    @if (env.isLoading()) { <p class="ui-muted"><span class="ui-spinner" aria-hidden="true"></span> Loading options…</p> }
  </ng-template>

  @if (form(); as form) {
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
  }

  <ng-template flowReceipt let-result>
    <h2 class="ui-title"><span aria-hidden="true">🎉</span> Account opened</h2>
    <p>Your confirmation id is <strong>{{ result.confirmationId }}</strong>.</p>
  </ng-template>
</tommy-flow-runner>
```

Write `newsletter-flow` and `insurance-flow` the SAME way, substituting:
- **newsletter** (selector `tommy-newsletter-flow`): imports `ContactStep` (`tommy-newsletter-contact-step`), `PrefsStep` (`tommy-newsletter-prefs-step`), `TosStep`; steps `form.contact` → `<tommy-newsletter-contact-step>`, `form.prefs` → `<tommy-newsletter-prefs-step>`, `form.tos` → `<tommy-tos-step [terms]>`; uses `newsletterForm`, `emptyNewsletterModel`, `NEWSLETTER_FLOW_CONFIG`, slug `'newsletter'`; intro copy from v1 newsletter `meta.intro`; receipt: `<h2>You're subscribed</h2><p>Your confirmation id is <strong>{{ result.confirmationId }}</strong>.</p>`.
- **insurance** (selector `tommy-insurance-flow`): imports `PolicyStep` (`tommy-insurance-policy-step`), `IncidentStep` (`tommy-insurance-incident-step`), `ItemsStep` (`tommy-insurance-items-step`), `TosStep`; steps `form.policy`, `form.incident`, `form.items`, `form.tos`; uses `insuranceForm`, `emptyInsuranceModel`, `INSURANCE_FLOW_CONFIG`, slug `'insurance'`; intro copy from v1 insurance `meta.intro`; receipt: `<h2>Claim filed</h2><p>Your confirmation id is <strong>{{ result.confirmationId }}</strong>.</p>`.

- [ ] **Step 8: Run the ported schema/fixtures specs**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern="flows/.*(schema|fixtures)"`
Expected: newsletter/insurance schema specs + bank fixtures spec pass (they are unchanged behavior).

- [ ] **Step 9: Write the bank round-trip integration spec** (ported to the v2 shape)

`flows/bank/round-trip.spec.ts` — drives the `<tommy-bank-flow>` component (not the runner directly), and uses `FlowResume` for PHASE B:
```ts
import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { BankFlow } from './bank-flow';
import { FlowBackend, FLOW_FIXTURES } from '../../engine/flow-backend';
import { ExternalRedirect } from '../../engine/external-redirect';
import { FlowStateStore } from '../../engine/flow-state-store';
import { FlowResume } from '../../engine/flow-resume';
import { bankFixture } from './fixtures';

class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'http://localhost:4200';
  to(url: string): void { this.lastUrl = url; }
}
const SNAPSHOT_KEY = 'flow-compose:snapshot';

function configure(redirect: FakeRedirect) {
  TestBed.configureTestingModule({
    imports: [BankFlow],
    providers: [
      FlowBackend, FlowStateStore, FlowResume,
      { provide: ExternalRedirect, useValue: redirect },
      { provide: FLOW_FIXTURES, useValue: new Map([['bank', bankFixture]]) },
    ],
  });
}

async function start(fixture: ComponentFixture<BankFlow>) {
  // env loads eagerly on mount (real 500ms); wait, then click Start.
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
  clickByText(fixture, 'Start');
}
function clickByText(fixture: ComponentFixture<BankFlow>, text: string) {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text || (b.textContent ?? '').includes(text));
  if (!btn) throw new Error(`button not found: ${text}`);
  btn.click();
  fixture.detectChanges();
}
function setInput(fixture: ComponentFixture<BankFlow>, sel: string, val: string) {
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(sel);
  if (!input) throw new Error(`input not found: ${sel}`);
  input.value = val; input.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
}
function pickRadio(fixture: ComponentFixture<BankFlow>, value: string) {
  const radio = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=radio]')).find((r) => r.value === value);
  if (!radio) throw new Error(`radio not found: ${value}`);
  radio.click(); fixture.detectChanges();
}
function acceptFirstTerm(fixture: ComponentFixture<BankFlow>) {
  const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=checkbox]');
  if (!box) throw new Error('TOS checkbox not found');
  box.click(); fixture.detectChanges();
}
async function clickSubmit(fixture: ComponentFixture<BankFlow>) {
  clickByText(fixture, 'Submit');
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

interface PersistedSnapshot { flowSlug: string; schemaVersion: number; state: string; challengeId: string; model: unknown; }

describe('Bank flow — MitID round-trip (v2, seam-faked integration)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('submit → 202 → approved callback → resume → 200 done (BANK-bank-0001)', async () => {
    // PHASE A: drive the bank-flow component to submit → 202 → snapshot + redirect.
    const redirect = new FakeRedirect();
    configure(redirect);
    const fixtureA = TestBed.createComponent(BankFlow);
    fixtureA.detectChanges();
    await start(fixtureA);
    setInput(fixtureA, '#bank-fullName', 'Tommy Tester');
    setInput(fixtureA, '#bank-cpr', '0101010001');
    clickByText(fixtureA, 'Next');
    pickRadio(fixtureA, 'standard');
    clickByText(fixtureA, 'Next');
    acceptFirstTerm(fixtureA);
    await clickSubmit(fixtureA);

    expect(redirect.lastUrl).not.toBeNull();
    const signingUrl = new URL(redirect.lastUrl as string);
    const redirectState = signingUrl.searchParams.get('state');
    expect(redirectState).toBeTruthy();
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw as string) as PersistedSnapshot;
    expect(snapshot.flowSlug).toBe('bank');
    expect(snapshot.state).toBe(redirectState);

    // PHASE B: simulate the approved callback through FlowResume, then mount a fresh
    // bank-flow (its constructor reads FlowResume.pending) → resume → 200 → receipt.
    const resumeSvc = TestBed.inject(FlowResume);
    const slug = resumeSvc.consume(
      { get: (k) => ({ mitid: 'callback', flow: 'bank', status: 'approved', state: redirectState!, code: 'otc-test' } as Record<string, string>)[k] ?? null },
      () => 1,
    );
    expect(slug).toBe('bank');

    const fixtureB = TestBed.createComponent(BankFlow);
    fixtureB.detectChanges();
    await new Promise((r) => setTimeout(r, 1300)); // loadOptions(500) + submit(500) real delays
    await fixtureB.whenStable();
    fixtureB.detectChanges();

    const text = (fixtureB.nativeElement as HTMLElement).textContent ?? '';
    // CPR 0101010001 → challengeId bank-0001 → confirmationId BANK-bank-0001.
    expect(text).toContain('BANK-bank-0001');
  });
});
```
Note: in PHASE B the snapshot was consumed in PHASE A's submit, then re-saved? No — PHASE A's 202 saved the snapshot; `resumeSvc.consume` reads it single-use. Ensure PHASE A's snapshot is still present when `consume` runs (it is — nothing else reads it). The fresh `fixtureB` reads `FlowResume.pending('bank')` in its constructor, so `consume` MUST run before `TestBed.createComponent(BankFlow)` for PHASE B — keep that order.

- [ ] **Step 10: Run all flow specs + commit**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern="flows/"`
Expected: schema/fixtures specs + bank round-trip pass.
```bash
git add libs/tommy/signal-forms/flow-compose/src/lib/flows libs/tommy/signal-forms/flow-compose/src/lib/steps
git commit -m "feat(flow-compose): port newsletter/bank/insurance as composed flow components + bank round-trip"
```

---

### Task 6: The @switch launcher + FLOW_CARDS + boot consume

**Goal:** A launcher component that renders the gallery, selects a flow by slug into a static `@switch`, co-provides the backend + fixtures, and auto-resumes on a MitID return via `FlowResume.consume`.

**Files:**
- Create: `src/lib/flow-compose.ts`, `src/lib/flow-compose.html`, `src/lib/flow-cards.ts`, `src/lib/flow-fixtures.ts`, `src/lib/flow-compose.spec.ts`

**Acceptance Criteria:**
- [ ] Gallery lists the three cards; clicking one renders the matching `<*-flow/>` via `@switch`
- [ ] `FLOW_FIXTURES` + `FlowBackend` are co-provided at the launcher
- [ ] On boot, a valid approved callback auto-selects the flow; a cancelled callback selects it and shows the resubmit notice
- [ ] No registry cast / `as AnyFlowDef` anywhere

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-compose` → pass.

**Steps:**

- [ ] **Step 1: Write `flow-fixtures.ts`** (the slug→fixture map for the backend)

```ts
import type { FlowFixture } from './engine/flow-backend';
import { newsletterFixture } from './flows/newsletter/fixtures';
import { bankFixture } from './flows/bank/fixtures';
import { insuranceFixture } from './flows/insurance/fixtures';

export const FLOW_FIXTURES_MAP = new Map<string, FlowFixture>([
  ['newsletter', newsletterFixture],
  ['bank', bankFixture],
  ['insurance', insuranceFixture],
]);
```
(If the v1 fixtures needed an `as FlowFixture` cast, prefer typing each `<name>Fixture` so no cast is needed; the `FlowFixture<Features>` generic is assignable to `FlowFixture` here.)

- [ ] **Step 2: Write `flow-cards.ts`** (gallery presentation data + versions)

```ts
import { NEWSLETTER_FLOW_CONFIG } from './flows/newsletter/newsletter-config';
import { BANK_FLOW_CONFIG } from './flows/bank/bank-config';
import { INSURANCE_FLOW_CONFIG } from './flows/insurance/insurance-config';

export interface FlowCard {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly dimension: 'minimal' | 'complex' | 'signing';
}

export const FLOW_CARDS: readonly FlowCard[] = [NEWSLETTER_FLOW_CONFIG, BANK_FLOW_CONFIG, INSURANCE_FLOW_CONFIG].map(
  (c) => ({ slug: c.meta.slug, title: c.meta.title, blurb: c.meta.blurb, dimension: c.meta.dimension }),
);

/** slug → schemaVersion, for FlowResume.consume. */
export const FLOW_VERSIONS: Record<string, number> = {
  [NEWSLETTER_FLOW_CONFIG.meta.slug]: NEWSLETTER_FLOW_CONFIG.schemaVersion,
  [BANK_FLOW_CONFIG.meta.slug]: BANK_FLOW_CONFIG.schemaVersion,
  [INSURANCE_FLOW_CONFIG.meta.slug]: INSURANCE_FLOW_CONFIG.schemaVersion,
};
```

- [ ] **Step 3: Write `flow-compose.ts`**

```ts
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FLOW_FIXTURES, FlowBackend } from './engine/flow-backend';
import { FlowResume } from './engine/flow-resume';
import { NewsletterFlow } from './flows/newsletter/newsletter-flow';
import { BankFlow } from './flows/bank/bank-flow';
import { InsuranceFlow } from './flows/insurance/insurance-flow';
import { FLOW_CARDS, FLOW_VERSIONS } from './flow-cards';
import { FLOW_FIXTURES_MAP } from './flow-fixtures';

@Component({
  selector: 'tommy-flow-compose',
  imports: [NewsletterFlow, BankFlow, InsuranceFlow],
  providers: [{ provide: FLOW_FIXTURES, useValue: FLOW_FIXTURES_MAP }, FlowBackend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-compose.html',
})
export class FlowCompose {
  private readonly route = inject(ActivatedRoute);
  private readonly resume = inject(FlowResume);

  protected readonly cards = FLOW_CARDS;
  protected readonly selected = signal<string | null>(null);
  protected readonly returnNotice = signal<string | null>(null);

  constructor() {
    const slug = this.resume.consume(this.route.snapshot.queryParamMap, (s) => FLOW_VERSIONS[s]);
    if (slug) {
      this.selected.set(slug);
      if (this.resume.cancelledNotice(slug)) {
        this.returnNotice.set('Signing cancelled — you can review and resubmit.');
      }
    }
  }

  select(slug: string): void {
    this.returnNotice.set(null);
    this.selected.set(slug);
  }
  clear(): void {
    this.selected.set(null);
  }
  badgeClass(dimension: string): string {
    return dimension === 'signing' ? 'ui-badge-orange' : dimension === 'complex' ? 'ui-badge-green' : 'ui-badge-blue';
  }
}
```

- [ ] **Step 4: Write `flow-compose.html`**

```html
@if (selected(); as slug) {
  @if (returnNotice(); as notice) {
    <p class="ui-banner-warning" role="status">{{ notice }}</p>
  }
  <button type="button" class="ui-btn ui-foot" (click)="clear()">← All flows</button>
  @switch (slug) {
    @case ('newsletter') { <tommy-newsletter-flow /> }
    @case ('bank') { <tommy-bank-flow /> }
    @case ('insurance') { <tommy-insurance-flow /> }
  }
} @else {
  <header class="ui-stack">
    <h2 class="ui-title">Flow Compose</h2>
    <p class="ui-muted">
      Composition over interpretation: each flow is a component that composes the
      runner. Pick a flow to run it.
    </p>
  </header>
  <ul class="ui-gallery">
    @for (card of cards; track card.slug) {
      <li>
        <button type="button" class="ui-flow-card" [attr.data-flow]="card.slug" (click)="select(card.slug)">
          <span class="ui-badge" [class]="badgeClass(card.dimension)">{{ card.dimension }}</span>
          <strong class="ui-title">{{ card.title }}</strong>
          <span class="ui-muted">{{ card.blurb }}</span>
        </button>
      </li>
    }
  </ul>
}
```

- [ ] **Step 5: Write `flow-compose.spec.ts`**

```ts
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { FlowCompose } from './flow-compose';
import { FlowResume } from './engine/flow-resume';
import { FlowStateStore } from './engine/flow-state-store';

function routeWith(params: Record<string, string>) {
  return { snapshot: { queryParamMap: { get: (k: string) => params[k] ?? null } } } as unknown as ActivatedRoute;
}

describe('FlowCompose launcher', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('lists all flow cards in the gallery', () => {
    TestBed.configureTestingModule({
      imports: [FlowCompose],
      providers: [FlowResume, FlowStateStore, { provide: ActivatedRoute, useValue: routeWith({}) }],
    });
    const fixture = TestBed.createComponent(FlowCompose);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-flow=newsletter]')).not.toBeNull();
    expect(el.querySelector('[data-flow=bank]')).not.toBeNull();
    expect(el.querySelector('[data-flow=insurance]')).not.toBeNull();
  });

  it('clicking a card renders that flow component', () => {
    TestBed.configureTestingModule({
      imports: [FlowCompose],
      providers: [FlowResume, FlowStateStore, { provide: ActivatedRoute, useValue: routeWith({}) }],
    });
    const fixture = TestBed.createComponent(FlowCompose);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-flow=newsletter]')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('tommy-newsletter-flow')).not.toBeNull();
  });

  it('a cancelled MitID callback auto-selects the flow and shows the resubmit notice', () => {
    TestBed.configureTestingModule({
      imports: [FlowCompose],
      providers: [FlowResume, FlowStateStore, { provide: ActivatedRoute, useValue: routeWith({}) }],
    });
    // Seed a snapshot, then build the launcher with a cancelled callback route.
    TestBed.inject(FlowStateStore).save({ flowSlug: 'bank', schemaVersion: 1, state: 'st-1', challengeId: 'c', model: {} });
    TestBed.overrideProvider(ActivatedRoute, { useValue: routeWith({ mitid: 'callback', flow: 'bank', status: 'cancelled', state: 'st-1' }) });
    const fixture = TestBed.createComponent(FlowCompose);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=status]')?.textContent).toContain('Signing cancelled');
    expect(el.querySelector('tommy-bank-flow')).not.toBeNull();
  });
});
```
Note: if `TestBed.overrideProvider` after `configureTestingModule` is awkward for the third test, configure that test in its own `configureTestingModule` with the cancelled route directly. The bank-flow child will try to load env (real backend); provide `FLOW_FIXTURES` + `FlowBackend` for that test (co-provided by the launcher already) — add them to the test providers if the child fails to resolve a fixture.

- [ ] **Step 6: Run + commit**

Run: `pnpm nx test tommy-signal-forms-flow-compose --testPathPattern=flow-compose` → PASS.
```bash
git add libs/tommy/signal-forms/flow-compose/src/lib
git commit -m "feat(flow-compose): @switch launcher + flow cards + boot resume consume"
```

---

### Task 7: Public API, AOT gate, README, full green

**Goal:** Export the public surface, wire the host so `strictTemplates` actually compiles the v2 templates (the central type-safety claim), document the ledger, and prove the whole lib green.

**Files:**
- Create/replace: `src/index.ts`, `src/lib/flow-compose/README.md` → actually `libs/tommy/signal-forms/flow-compose/README.md`
- Modify: `apps/tommy/host/src/app/experiments/registry.ts`, `apps/tommy/host/src/app/experiments/experiment.spec.ts`

**Acceptance Criteria:**
- [ ] `index.ts` exports `FlowCompose`, `FlowRunner`, `FlowStep`, `FlowIntro`, `FlowReceipt`, `FlowConfig` + the public types (`FlowMeta`, `FlowEnvelope`, `Signature`, `SubmitOk`, `SubmitOutcome`, `ServerFieldError`) — and NOT any FlowError
- [ ] The host registry has a `flow-compose` experiment lazy-loading `m.FlowCompose`; `experiment.spec.ts` asserts the new slug order
- [ ] `pnpm nx build tommy-host` succeeds (AOT `strictTemplates` compiles every flow template)
- [ ] `pnpm nx test tommy-signal-forms-flow-compose` and `pnpm nx test tommy-host` both green
- [ ] README states the ledger: concedes "strictly better-typed", records the lost runtime guarantee + the per-flow cost of the two required slots (error page free), and the deferred generator / shared-core extraction

**Verify:** `pnpm nx test tommy-signal-forms-flow-compose && pnpm nx build tommy-host && pnpm nx test tommy-host` → all green.

**Steps:**

- [ ] **Step 1: Write `src/index.ts`**

```ts
export { FlowCompose } from './lib/flow-compose';
export { FlowRunner } from './lib/engine/flow-runner';
export { FlowStep, type FlowStepContext } from './lib/engine/flow-step';
export { FlowIntro, FlowReceipt, type FlowReceiptContext } from './lib/engine/flow-slots';
export type { FlowConfig } from './lib/engine/flow-config';
export type {
  FlowMeta, FlowEnvelope, FeatureMap, FeatureDescriptor, TermsMap, TermDescriptor,
  ServerFieldError, Signature, SubmitOk, SubmitOutcome,
} from './lib/engine/flow-types';
```

- [ ] **Step 2: Register the experiment in the host** (the AOT gate hook)

In `apps/tommy/host/src/app/experiments/registry.ts`, append to `EXPERIMENTS` after the `flow-forge` entry:
```ts
  {
    slug: 'flow-compose',
    title: 'Flow Compose',
    description:
      'Flow Forge v2: composition over interpretation — each flow is a component that composes the runner via <ng-template flowStep>, with per-flow intro/receipt slots.',
    group: 'Signal Forms',
    tags: ['signals', 'multi-step', 'experimental'],
    sourcePath: 'libs/tommy/signal-forms/flow-compose',
    load: () =>
      import('@tommy/signal-forms/flow-compose').then((m) => m.FlowCompose),
  },
```

- [ ] **Step 3: Update the registry spec for the new slug**

In `apps/tommy/host/src/app/experiments/experiment.spec.ts`, the "groups experiments by group" test asserts the slug order. Update it:
```ts
    expect(groups[0].experiments.map((e) => e.slug)).toEqual([
      'signal-forms',
      'multi-step-form',
      'flow-forge',
      'flow-compose',
    ]);
```

- [ ] **Step 4: Run the AOT/strictTemplates gate**

Run: `pnpm nx build tommy-host`
Expected: SUCCESS. This compiles `<tommy-flow-compose>` and every flow template under AOT `strictTemplates`. If it fails with `NG8002`/`NG8022` (unknown input/binding), the offending step/slot binding does not match the real component input — fix the binding or input name. This is the gate that proves the type-safety claim; it MUST pass.

- [ ] **Step 5: Write the README** (`libs/tommy/signal-forms/flow-compose/README.md`)

Include: the principle (compose engine parts, CDK-stepper shape); the contract (`FlowRunner`, `FlowStep`, `FlowIntro`/`FlowReceipt`, `FlowConfig`); how to add a flow (component + form builder + config + steps + slots, register the card + fixture + version + host entry); and **the ledger** verbatim in spirit:
- Gained — concede out loud: strictly better-typed than Flow Forge; deleted `StepDef`/`defineStep`/`StepComponent`/the registry cast/`NgComponentOutlet`/the unchecked-inputs risk class.
- Lost — Nicholas's runtime guarantee (interpreter *can't* deviate) for a conventional one (composition *doesn't*); ~55–90 lines of per-flow repetition from the two required slots + load/form block (the error page is free, runner-owned chrome).
- Deferred — the Nx `flows:flow` generator and a shared `flow-core` extraction.
Mention the MitID round-trip is seam-tested in `flows/bank/round-trip.spec.ts` and the true cross-origin hop is manual via the host + `mock-idp` apps (v2 route `/flow-compose`).

- [ ] **Step 6: Full green + commit**

Run:
```bash
pnpm nx test tommy-signal-forms-flow-compose
pnpm nx test tommy-host
pnpm nx lint tommy-signal-forms-flow-compose
```
Expected: all green.
```bash
git add libs/tommy/signal-forms/flow-compose apps/tommy/host/src/app/experiments
git commit -m "feat(flow-compose): public API, host registration (AOT gate), README ledger"
```

---

## Notes for the implementer

- **Run the whole lib's tests after each task**, not just the filtered set, to catch cross-file breakage early: `pnpm nx test tommy-signal-forms-flow-compose`.
- **`resource()` API:** `env.hasValue()`, `env.value()` (typed `T | undefined` — use `!` after `hasValue()`), `env.error()`, `env.isLoading()`, `env.reload()`. Loads eagerly on component construction.
- **Injection context:** build the signal-forms `form()` inside `runInInjectionContext(injector, …)` (see each `form.ts`). The flow component's `computed` is not guaranteed to run in an injection context.
- **Do not modify v1** (`libs/tommy/signal-forms/flow-forge`) — it stays frozen for the A/B comparison.
