# Multi-Step Signal Forms Flow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build experiment #2 `@tommy/multi-step-form` — a signup-style wizard on `@angular/forms/signals` that loads backend constraints, drives validation from composed reusable schemas, supports cross-field + dynamic-array rules, and submits through the `submit()` server-error pathway.

**Architecture:** Approach A — one root form over `{ profile, account, tos[] }`, built *after* the simulated backend returns `FlowOptions`, via `runInInjectionContext`. Reusable sub-schemas (`profileSchema`, `accountSchema(opts)`, `tosItemSchema`) compose into `flowSchema(opts)` with `apply`/`applyEach`. A container owns phase/step state, validity-gated navigation, and submit; presentational step components render `FieldTree` slices. Styling uses a small stable `ui.css` design layer (Tailwind v4 + spartan-ng tokens, with a plain-CSS fallback) so components never depend on the alpha UI lib working.

**Tech Stack:** Nx 22.7.5 · Angular 21.2.9 · `@angular/forms/signals` (experimental) · Vitest (vitest-analog) · Tailwind v4 + spartan-ng (fallback: plain CSS).

**Spec:** `docs/superpowers/specs/2026-06-06-multi-step-signal-forms-flow-design.md`

---

## Verified API facts (Angular 21.2.9 `@angular/forms/signals`)

These were confirmed against the installed `.d.ts` files; rely on them:

- `form(model, schemaOrOptions)` — needs an injection context. Build post-load via `runInInjectionContext(injector, () => form(model, flowSchema(opts)))`.
- `schema<T>(fn)`, `apply(path, schema)`, `applyEach(arrayPath, itemSchema)`, `applyWhen`.
- Validators: `required(path, {message})`, `minLength(path, n, {message})`, `maxLength`, `min`, `max`, `email(path, {message})`, `pattern`.
- `validate(path, (ctx) => ValidationResult)`. `ctx.value()` = this field's value; `ctx.valueOf(otherPath)` = another field's value; on array items `ctx.index()`.
- **Custom error:** return a plain object `{ kind: string, message?: string }` (or `null` for valid). No factory needed.
- `submit(form, { action })` → `Promise<boolean>`. `action(field)` returns a `TreeValidationResult`; return `null` for success, or `[{ kind, message, fieldTree: field.account.username }]` to target server errors at a field.
- `FieldTree<T[]>` is numerically indexable **and** iterable, with `.length`. `FieldTree<Obj>` exposes children as properties. Calling a node (`node()`) returns its `FieldState` (`.value()`, `.valid()`, `.invalid()`, `.touched()`, `.errors()`).
- `[formField]` (directive `FormField`) binds native inputs incl. checkboxes.

---

## File structure

```
libs/tommy/multi-step-form/
  src/
    index.ts                         # barrel: exports MultiStepFlow
    lib/
      flow-options.ts                # backend contract types (FlowOptions, TosItem, FlowSubmission, SubmitResult)
      flow.service.ts                # simulated backend (Promises + setTimeout)
      flow.service.spec.ts
      flow-model.ts                  # ProfileGroup/AccountGroup/TosAck/FlowModel + emptyFlowModel
      flow-schema.ts                 # profileSchema, accountSchema(opts), tosItemSchema, flowSchema(opts)
      flow-schema.spec.ts
      create-flow-form.ts            # createFlowForm(opts, injector) -> { model, form }
      create-flow-form.spec.ts
      ui.css                         # stable .ui-* design classes (spartan/Tailwind OR plain-CSS fallback)
      multi-step-flow.ts/.html/.css  # container (entry component)
      multi-step-flow.spec.ts
      step-indicator.ts              # presentational stepper
      steps/
        profile-step.ts
        account-step.ts
        tos-step.ts
        steps.spec.ts                # smoke render tests
apps/tommy/host/src/app/experiments.ts   # +1 EXPERIMENTS entry
tsconfig.base.json                       # +1 path alias
```

---

### Task 1: Scaffold `@tommy/multi-step-form` lib + host wiring

**Goal:** A new Angular library registered as experiment #2, reachable at `/multi-step-form` with a minimal intro placeholder.

**Files:**
- Create (generated): `libs/tommy/multi-step-form/**`
- Create: `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`, `.html`, `.css`
- Modify: `libs/tommy/multi-step-form/src/index.ts`
- Modify: `tsconfig.base.json` (add path alias)
- Modify: `apps/tommy/host/src/app/experiments.ts` (add entry)
- Delete: the generator's sample component folder/spec (replaced by our own)

**Acceptance Criteria:**
- [ ] Lib generated under `libs/tommy/multi-step-form` with tags `scope:tommy,type:experiment`, prefix `tommy`
- [ ] `@tommy/multi-step-form` resolves to `./libs/tommy/multi-step-form/src/index.ts`
- [ ] `EXPERIMENTS` has a `multi-step-form` entry; nav + landing card + `/multi-step-form` route appear
- [ ] `MultiStepFlow` renders an intro with a "Start" button
- [ ] `pnpm nx lint tommy-multi-step-form` and `pnpm nx test tommy-multi-step-form` pass

**Verify:** `pnpm nx serve tommy-host` → open `/multi-step-form` → see the intro card; `pnpm nx lint tommy-multi-step-form` → no errors.

**Steps:**

- [ ] **Step 1: Generate the library (use the nx-generate skill per CLAUDE.md; do not guess flags)**

Per CLAUDE.md, invoke the `nx-generate` skill first. The intended generator and options:

```bash
pnpm nx g @nx/angular:library multi-step-form \
  --directory=libs/tommy/multi-step-form \
  --tags=scope:tommy,type:experiment \
  --prefix=tommy --style=css \
  --unitTestRunner=vitest --linter=eslint --standalone
```

Confirm exact flag names with `pnpm nx g @nx/angular:library --help` before running (workspace defaults in `nx.json` already set `unitTestRunner: vitest-analog` and `linter: eslint`).

- [ ] **Step 2: Verify the path alias was added (fix if missing)**

The generator usually appends to `tsconfig.base.json`. Ensure this entry exists under `compilerOptions.paths` (match the existing `@tommy/signal-forms` style with the leading `./`):

```json
"@tommy/multi-step-form": ["./libs/tommy/multi-step-form/src/index.ts"]
```

- [ ] **Step 3: Replace the generated sample component with the placeholder container**

Delete the generator's sample component (e.g. `src/lib/multi-step-form/`) and its spec. Create `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`:

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Entry component for the multi-step signal-forms experiment.
 *
 * Task 1 ships only the intro placeholder so routing works end-to-end;
 * Task 6 fleshes this out into the full phase/step state machine.
 */
@Component({
  selector: 'tommy-multi-step-flow',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-step-flow.html',
  styleUrl: './multi-step-flow.css',
})
export class MultiStepFlow {}
```

Create `libs/tommy/multi-step-form/src/lib/multi-step-flow.html`:

```html
<section class="ms-card">
  <h2>Create your account</h2>
  <p>A guided, multi-step sign-up powered by Angular signal forms.</p>
  <button type="button" class="ms-btn ms-btn-primary">Start</button>
</section>
```

Create `libs/tommy/multi-step-form/src/lib/multi-step-flow.css` (temporary local styles; superseded by `ui.css` in Task 2):

```css
:host { display: block; max-width: 32rem; font-family: system-ui, sans-serif; }
.ms-card { padding: 1.5rem; border: 1px solid #d0d7de; border-radius: 0.75rem; }
.ms-btn { padding: 0.5rem 0.875rem; border-radius: 0.5rem; border: 1px solid #d0d7de; cursor: pointer; }
.ms-btn-primary { background: #1f883d; color: #fff; border-color: transparent; }
```

- [ ] **Step 4: Export from the barrel**

Replace `libs/tommy/multi-step-form/src/index.ts`:

```ts
export * from './lib/multi-step-flow';
```

- [ ] **Step 5: Register the experiment**

In `apps/tommy/host/src/app/experiments.ts`, append to the `EXPERIMENTS` array:

```ts
  {
    slug: 'multi-step-form',
    title: 'Multi-Step Form',
    description:
      'A signup-style wizard on @angular/forms/signals: backend-driven constraints, composed schemas, and a server-error submit.',
    load: () =>
      import('@tommy/multi-step-form').then((m) => m.MultiStepFlow),
  },
```

- [ ] **Step 6: Verify routing, lint, test**

```bash
pnpm nx lint tommy-multi-step-form
pnpm nx test tommy-multi-step-form
pnpm nx build tommy-host
```
Expected: all pass; build emits a separate lazy chunk for `multi-step-form`.

- [ ] **Step 7: Commit**

```bash
git add libs/tommy/multi-step-form apps/tommy/host/src/app/experiments.ts tsconfig.base.json
git commit -m "$(printf 'feat(multi-step-form): scaffold lib + register experiment\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 2: Establish the `ui.css` design layer (Tailwind v4 + spartan-ng, plain-CSS fallback)

**Goal:** A single stable stylesheet of `.ui-*` classes that every component references, so downstream tasks are never blocked on the alpha UI lib working.

**Files:**
- Create: `libs/tommy/multi-step-form/src/lib/ui.css`
- Modify: `apps/tommy/host/src/styles.css` (import Tailwind + theme; include `ui.css`)
- Possibly create: `.postcssrc.json` (Tailwind v4 PostCSS plugin), `package.json` deps
- Modify: `apps/tommy/host/project.json` only if a styles entry is needed

**Acceptance Criteria:**
- [ ] `ui.css` defines, at minimum: `.ui-card`, `.ui-input`, `.ui-label`, `.ui-error`, `.ui-btn`, `.ui-btn-primary`, `.ui-muted`, `.ui-step`, `.ui-step-active`, `.ui-step-done`
- [ ] Primary path: Tailwind v4 + spartan-ng theme tokens installed and compiling in the host build, OR documented fallback to plain CSS using the **same class names**
- [ ] `pnpm nx build tommy-host` succeeds and a styled element renders (e.g. the intro "Start" button shows the primary style)
- [ ] If spartan-ng was used, the lib `README.md` records the exact installed `@spartan-ng/*` versions and any helm import paths consulted

**Verify:** `pnpm nx serve tommy-host` → `/multi-step-form` intro button is visibly styled (filled primary); `pnpm nx build tommy-host` exits 0.

**Steps:**

- [ ] **Step 1: Install styling deps (primary path)**

```bash
pnpm add -D tailwindcss @tailwindcss/postcss
pnpm add @spartan-ng/brain @spartan-ng/helm
```
(`@spartan-ng/brain@^0.0.1-alpha.706` declares peer `@angular/core >=20 <22`, compatible with 21.2.9.)

- [ ] **Step 2: Wire Tailwind v4 into the host build**

Create `.postcssrc.json` at the workspace root:

```json
{ "plugins": { "@tailwindcss/postcss": {} } }
```

Prepend to `apps/tommy/host/src/styles.css`:

```css
@import 'tailwindcss';
/* spartan-ng theme tokens (CSS variables for --background, --foreground, --input, --ring, etc.)
   Follow the spartan-ng "Install Tailwind" guide for the installed version; if it provides a
   themes/preset import, add it here. */
```

- [ ] **Step 3: Author `ui.css` (primary: `@apply` Tailwind utilities)**

Create `libs/tommy/multi-step-form/src/lib/ui.css`. Use `@apply` so the look tracks the spartan theme tokens:

```css
.ui-card { @apply max-w-xl rounded-xl border border-gray-200 bg-white p-6 shadow-sm; }
.ui-label { @apply mb-1 block text-sm font-medium text-gray-900; }
.ui-input { @apply h-9 w-full rounded-md border border-gray-300 bg-transparent px-3 py-1 text-sm shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-gray-400; }
.ui-error { @apply text-sm text-red-600; }
.ui-muted { @apply text-sm text-gray-500; }
.ui-btn { @apply inline-flex items-center justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50; }
.ui-btn-primary { @apply border-transparent bg-gray-900 text-white hover:bg-gray-800; }
.ui-step { @apply flex items-center gap-2 text-sm text-gray-400; }
.ui-step-active { @apply font-semibold text-gray-900; }
.ui-step-done { @apply text-green-600; }
```

Import `ui.css` into the host `styles.css` (so utilities resolve globally), or reference it from each component's `styleUrl`. Prefer global import in `styles.css`:

```css
@import '../../../libs/tommy/multi-step-form/src/lib/ui.css';
```

- [ ] **Step 4: Swap the Task-1 placeholder to `ui-*` classes**

Update `multi-step-flow.html` (`ms-card`→`ui-card`, `ms-btn ms-btn-primary`→`ui-btn ui-btn-primary`) and delete the temporary rules from `multi-step-flow.css`.

- [ ] **Step 5: Verify the build renders styled output**

```bash
pnpm nx build tommy-host
pnpm nx serve tommy-host   # visually confirm the styled Start button
```

- [ ] **Step 6 (fallback, ONLY if Step 5 fails on the alpha/Tailwind stack): plain CSS, same class names**

Remove the Tailwind/spartan deps and `.postcssrc.json`. Rewrite `ui.css` as plain CSS with the **same selectors** (so no component changes are needed downstream), e.g.:

```css
.ui-card { max-width: 32rem; border: 1px solid #d0d7de; border-radius: .75rem; padding: 1.5rem; background:#fff; }
.ui-label { display:block; margin-bottom:.25rem; font-size:.875rem; font-weight:500; }
.ui-input { height:2.25rem; width:100%; border:1px solid #d0d7de; border-radius:.375rem; padding:.25rem .75rem; font:inherit; }
.ui-input:focus-visible { outline:2px solid #0969da; outline-offset:1px; }
.ui-error { color:#cf222e; font-size:.875rem; }
.ui-muted { color:#57606a; font-size:.875rem; }
.ui-btn { display:inline-flex; align-items:center; justify-content:center; border:1px solid #d0d7de; border-radius:.375rem; padding:.5rem 1rem; font:inherit; cursor:pointer; }
.ui-btn:disabled { opacity:.5; cursor:not-allowed; }
.ui-btn-primary { background:#1f2328; color:#fff; border-color:transparent; }
.ui-step { display:flex; align-items:center; gap:.5rem; font-size:.875rem; color:#8c959f; }
.ui-step-active { color:#1f2328; font-weight:600; }
.ui-step-done { color:#1a7f37; }
```
Record in the lib `README.md` that the fallback was taken and why.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(printf 'feat(multi-step-form): add ui.css design layer (tailwind+spartan, plain-css fallback)\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 3: Backend contract types + simulated `FlowService`

**Goal:** Typed backend contract and an injectable service that simulates async option loading and submission (deterministic, fake-timer friendly).

**Files:**
- Create: `libs/tommy/multi-step-form/src/lib/flow-options.ts`
- Create: `libs/tommy/multi-step-form/src/lib/flow.service.ts`
- Test: `libs/tommy/multi-step-form/src/lib/flow.service.spec.ts`

**Acceptance Criteria:**
- [ ] `loadOptions()` resolves `FlowOptions` with `username`/`password` constraints and a `tos` list containing ≥1 required and ≥1 optional item
- [ ] `submitFlow()` returns `{ ok:false, fieldErrors:[{field:'username',…}] }` when username is `"taken"` (case-insensitive), else `{ ok:true, confirmationId }` containing the username
- [ ] No `Math.random`/`Date.now` (deterministic); delay is via `setTimeout` so tests can use fake timers

**Verify:** `pnpm nx test tommy-multi-step-form` → `flow.service.spec.ts` passes.

**Steps:**

- [ ] **Step 1: Write the contract types**

Create `flow-options.ts`:

```ts
/** A single Terms-of-Service item the backend asks the user to acknowledge. */
export interface TosItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly required: boolean;
}

/** Constraints + TOS the "backend" returns when the flow starts. */
export interface FlowOptions {
  readonly username: { readonly minLength: number; readonly maxLength: number };
  readonly password: { readonly minLength: number };
  readonly tos: readonly TosItem[]; // 0..*
}

/** The payload we send back on submit. */
export interface FlowSubmission {
  readonly profile: { firstName: string; lastName: string; email: string };
  readonly account: { username: string; password: string };
  readonly acceptedTosIds: readonly string[];
}

/** Result of a submit attempt. */
export type SubmitResult =
  | { readonly ok: true; readonly confirmationId: string }
  | {
      readonly ok: false;
      readonly fieldErrors: readonly { readonly field: 'username'; readonly message: string }[];
    };
```

- [ ] **Step 2: Write the failing service test**

Create `flow.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { FlowService } from './flow.service';
import type { FlowSubmission } from './flow-options';

function submission(over: Partial<FlowSubmission['account']> = {}): FlowSubmission {
  return {
    profile: { firstName: 'Tommy', lastName: 'C', email: 'tommy@example.com' },
    account: { username: 'tommy123', password: 'super-secret', ...over },
    acceptedTosIds: ['privacy', 'terms'],
  };
}

describe('FlowService (simulated backend)', () => {
  let service: FlowService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FlowService] });
    service = TestBed.inject(FlowService);
  });

  it('loads options with at least one required and one optional TOS item', async () => {
    vi.useFakeTimers();
    const p = service.loadOptions();
    await vi.runAllTimersAsync();
    const opts = await p;
    vi.useRealTimers();

    expect(opts.username.minLength).toBeGreaterThan(0);
    expect(opts.tos.some((t) => t.required)).toBe(true);
    expect(opts.tos.some((t) => !t.required)).toBe(true);
  });

  it('rejects the reserved username "taken" with a username field error', async () => {
    vi.useFakeTimers();
    const p = service.submitFlow(submission({ username: 'Taken' }));
    await vi.runAllTimersAsync();
    const res = await p;
    vi.useRealTimers();

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.fieldErrors[0].field).toBe('username');
  });

  it('succeeds with a confirmation id otherwise', async () => {
    vi.useFakeTimers();
    const p = service.submitFlow(submission({ username: 'tommy123' }));
    await vi.runAllTimersAsync();
    const res = await p;
    vi.useRealTimers();

    expect(res.ok).toBe(true);
    if (res.ok) expect(res.confirmationId).toContain('tommy123');
  });
});
```

- [ ] **Step 3: Run the test (expect FAIL — `FlowService` not defined)**

```bash
pnpm nx test tommy-multi-step-form -- flow.service
```
Expected: fails to import `./flow.service`.

- [ ] **Step 4: Implement `FlowService`**

Create `flow.service.ts`:

```ts
import { Injectable } from '@angular/core';
import type { FlowOptions, FlowSubmission, SubmitResult } from './flow-options';

const DELAY_MS = 600;

function delay<T>(value: T, ms = DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Stand-in for a real HTTP backend. Deterministic on purpose: the username
 * "taken" is always rejected so the submit() server-error path is testable.
 */
@Injectable()
export class FlowService {
  loadOptions(): Promise<FlowOptions> {
    return delay({
      username: { minLength: 4, maxLength: 20 },
      password: { minLength: 8 },
      tos: [
        { id: 'privacy', title: 'Privacy Policy', body: 'We process your data as described in our policy.', required: true },
        { id: 'terms', title: 'Terms of Service', body: 'By creating an account you agree to our terms.', required: true },
        { id: 'marketing', title: 'Product updates', body: 'Send me occasional product news (optional).', required: false },
      ],
    });
  }

  submitFlow(submission: FlowSubmission): Promise<SubmitResult> {
    if (submission.account.username.trim().toLowerCase() === 'taken') {
      return delay<SubmitResult>({
        ok: false,
        fieldErrors: [{ field: 'username', message: 'That username is already taken' }],
      });
    }
    return delay<SubmitResult>({
      ok: true,
      confirmationId: `SIGNUP-${submission.account.username}`,
    });
  }
}
```

- [ ] **Step 5: Run the test (expect PASS)**

```bash
pnpm nx test tommy-multi-step-form -- flow.service
```
Expected: 3 passing.

- [ ] **Step 6: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/flow-options.ts libs/tommy/multi-step-form/src/lib/flow.service.ts libs/tommy/multi-step-form/src/lib/flow.service.spec.ts
git commit -m "$(printf 'feat(multi-step-form): backend contract types + simulated FlowService\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 4: Model + reusable composed schemas + `createFlowForm`

**Goal:** The form model, three reusable sub-schemas composed into `flowSchema(opts)`, and a factory that builds the root form after options load.

**Files:**
- Create: `libs/tommy/multi-step-form/src/lib/flow-model.ts`
- Create: `libs/tommy/multi-step-form/src/lib/flow-schema.ts`
- Create: `libs/tommy/multi-step-form/src/lib/create-flow-form.ts`
- Test: `libs/tommy/multi-step-form/src/lib/flow-schema.spec.ts`
- Test: `libs/tommy/multi-step-form/src/lib/create-flow-form.spec.ts`

**Acceptance Criteria:**
- [ ] `accountSchema(opts)` enforces username `minLength`/`maxLength` from `opts` and password `minLength` from `opts`
- [ ] `confirmPassword` is invalid (kind `passwordMismatch`) unless it equals `password`
- [ ] A required TOS item with `accepted=false` is invalid (kind `mustAccept`); an optional one is valid
- [ ] `flowSchema` composes all three; the root form is valid only when every group is valid; `form().value()` returns the full `FlowModel`
- [ ] `emptyFlowModel(opts)` seeds `tos[]` from `opts.tos` (ids + required flags, `accepted=false`)
- [ ] `createFlowForm(opts, injector)` returns `{ model, form }` with the form built inside `runInInjectionContext`

**Verify:** `pnpm nx test tommy-multi-step-form` → schema + factory specs pass.

**Steps:**

- [ ] **Step 1: Write the model**

Create `flow-model.ts`:

```ts
import type { FlowOptions } from './flow-options';

export interface ProfileGroup { firstName: string; lastName: string; email: string; }
export interface AccountGroup { username: string; password: string; confirmPassword: string; }
export interface TosAck { id: string; required: boolean; accepted: boolean; }
export interface FlowModel { profile: ProfileGroup; account: AccountGroup; tos: TosAck[]; }

/** A fresh model whose TOS array mirrors the backend-provided list. */
export function emptyFlowModel(options: FlowOptions): FlowModel {
  return {
    profile: { firstName: '', lastName: '', email: '' },
    account: { username: '', password: '', confirmPassword: '' },
    tos: options.tos.map((t) => ({ id: t.id, required: t.required, accepted: false })),
  };
}
```

- [ ] **Step 2: Write the failing schema test**

Create `flow-schema.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import type { FlowOptions } from './flow-options';
import { emptyFlowModel, type FlowModel } from './flow-model';
import { flowSchema } from './flow-schema';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [
    { id: 'terms', title: 'Terms', body: '', required: true },
    { id: 'news', title: 'News', body: '', required: false },
  ],
};

function build(initial?: Partial<FlowModel>) {
  return TestBed.runInInjectionContext(() => {
    const model = signal<FlowModel>({ ...emptyFlowModel(OPTS), ...initial });
    return { model, form: form(model, flowSchema(OPTS)) };
  });
}

describe('flowSchema (composed signal-forms logic)', () => {
  it('is invalid when empty', () => {
    const { form } = build();
    expect(form().valid()).toBe(false);
  });

  it('applies backend username min length', () => {
    const { model, form } = build();
    model.update((m) => ({ ...m, account: { ...m.account, username: 'abc' } })); // 3 < 4
    expect(form.account.username().invalid()).toBe(true);
    model.update((m) => ({ ...m, account: { ...m.account, username: 'abcd' } })); // 4
    expect(form.account.username().errors().some((e) => e.kind === 'minLength')).toBe(false);
  });

  it('requires confirmPassword to match password', () => {
    const { model, form } = build({
      account: { username: 'tommy', password: 'super-secret', confirmPassword: 'nope' },
    });
    expect(form.account.confirmPassword().errors().some((e) => e.kind === 'passwordMismatch')).toBe(true);
    model.update((m) => ({ ...m, account: { ...m.account, confirmPassword: 'super-secret' } }));
    expect(form.account.confirmPassword().valid()).toBe(true);
  });

  it('requires required TOS items but ignores optional ones', () => {
    const { model, form } = build();
    expect(form.tos().valid()).toBe(false); // 'terms' required, not accepted
    model.update((m) => ({
      ...m,
      tos: m.tos.map((t) => (t.required ? { ...t, accepted: true } : t)),
    }));
    expect(form.tos().valid()).toBe(true); // optional 'news' left false is fine
  });

  it('becomes valid once every group is valid and exposes the full value', () => {
    const { form } = build({
      profile: { firstName: 'Tommy', lastName: 'C', email: 'tommy@example.com' },
      account: { username: 'tommy', password: 'super-secret', confirmPassword: 'super-secret' },
      tos: [
        { id: 'terms', required: true, accepted: true },
        { id: 'news', required: false, accepted: false },
      ],
    });
    expect(form().valid()).toBe(true);
    expect(form().value().account.username).toBe('tommy');
    expect(form().value().tos.length).toBe(2);
  });

  it('emptyFlowModel seeds the TOS array from options', () => {
    const model = emptyFlowModel(OPTS);
    expect(model.tos.map((t) => t.id)).toEqual(['terms', 'news']);
    expect(model.tos.find((t) => t.id === 'terms')?.required).toBe(true);
    expect(model.tos.every((t) => t.accepted === false)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test (expect FAIL — `flow-schema` not defined)**

```bash
pnpm nx test tommy-multi-step-form -- flow-schema
```

- [ ] **Step 4: Implement the schemas**

Create `flow-schema.ts`:

```ts
import {
  apply,
  applyEach,
  email,
  maxLength,
  minLength,
  required,
  schema,
  validate,
} from '@angular/forms/signals';
import type { FlowOptions } from './flow-options';
import type { AccountGroup, FlowModel, ProfileGroup, TosAck } from './flow-model';

/** Step 1 — static personal details. Reusable across forms. */
export const profileSchema = schema<ProfileGroup>((p) => {
  required(p.firstName, { message: 'First name is required' });
  required(p.lastName, { message: 'Last name is required' });
  required(p.email, { message: 'Email is required' });
  email(p.email, { message: 'Enter a valid email address' });
});

/** Step 2 — credentials, parameterized by backend constraints + cross-field match. */
export function accountSchema(options: FlowOptions) {
  return schema<AccountGroup>((p) => {
    required(p.username, { message: 'Username is required' });
    minLength(p.username, options.username.minLength, {
      message: `Username must be at least ${options.username.minLength} characters`,
    });
    maxLength(p.username, options.username.maxLength, {
      message: `Username must be at most ${options.username.maxLength} characters`,
    });
    required(p.password, { message: 'Password is required' });
    minLength(p.password, options.password.minLength, {
      message: `Password must be at least ${options.password.minLength} characters`,
    });
    required(p.confirmPassword, { message: 'Please confirm your password' });
    // Cross-field: read the sibling password value via the field context.
    validate(p.confirmPassword, (ctx) =>
      ctx.value() === ctx.valueOf(p.password)
        ? null
        : { kind: 'passwordMismatch', message: 'Passwords must match' },
    );
  });
}

/** Step 3 — one acknowledgement. A required item must be accepted. */
export const tosItemSchema = schema<TosAck>((p) => {
  validate(p.accepted, (ctx) =>
    ctx.valueOf(p.required) && !ctx.value()
      ? { kind: 'mustAccept', message: 'You must accept this to continue' }
      : null,
  );
});

/** The whole flow: compose the three reusable schemas onto the root model. */
export function flowSchema(options: FlowOptions) {
  return schema<FlowModel>((p) => {
    apply(p.profile, profileSchema);
    apply(p.account, accountSchema(options));
    applyEach(p.tos, tosItemSchema);
  });
}
```

> Contingency: if `applyEach(p.tos, tosItemSchema)` reports a `PathKind` type mismatch (prebuilt root schema vs. item path), inline it instead — the logic is identical:
> ```ts
> applyEach(p.tos, (item) => {
>   validate(item.accepted, (ctx) =>
>     ctx.valueOf(item.required) && !ctx.value()
>       ? { kind: 'mustAccept', message: 'You must accept this to continue' }
>       : null,
>   );
> });
> ```

- [ ] **Step 5: Run the schema test (expect PASS)**

```bash
pnpm nx test tommy-multi-step-form -- flow-schema
```
Expected: 6 passing. If a `kind` string differs from the built-in (e.g. minLength error kind), adjust the assertion to the actual `errors()[0].kind` observed.

- [ ] **Step 6: Write `createFlowForm` + its test**

Create `create-flow-form.ts`:

```ts
import { runInInjectionContext, signal, type Injector, type WritableSignal } from '@angular/core';
import { form, type FieldTree } from '@angular/forms/signals';
import type { FlowOptions } from './flow-options';
import { emptyFlowModel, type FlowModel } from './flow-model';
import { flowSchema } from './flow-schema';

export interface FlowForm {
  readonly model: WritableSignal<FlowModel>;
  readonly form: FieldTree<FlowModel>;
}

/**
 * Build the root form once the backend options are known. `form()` needs an
 * injection context, so we run it inside the caller's injector.
 */
export function createFlowForm(options: FlowOptions, injector: Injector): FlowForm {
  const model = signal<FlowModel>(emptyFlowModel(options));
  const tree = runInInjectionContext(injector, () => form(model, flowSchema(options)));
  return { model, form: tree };
}
```

Create `create-flow-form.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import type { FlowOptions } from './flow-options';
import { createFlowForm } from './create-flow-form';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [{ id: 'terms', title: 'Terms', body: '', required: true }],
};

describe('createFlowForm', () => {
  it('builds a form bound to a model seeded from options', () => {
    TestBed.runInInjectionContext(() => {
      const injector = TestBed.inject(Injector);
      const { model, form } = createFlowForm(OPTS, injector);
      expect(model().tos.length).toBe(1);
      expect(form().valid()).toBe(false);
    });
  });
});
```

- [ ] **Step 7: Run both specs (expect PASS)**

```bash
pnpm nx test tommy-multi-step-form
```

- [ ] **Step 8: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/flow-model.ts libs/tommy/multi-step-form/src/lib/flow-schema.ts libs/tommy/multi-step-form/src/lib/create-flow-form.ts libs/tommy/multi-step-form/src/lib/flow-schema.spec.ts libs/tommy/multi-step-form/src/lib/create-flow-form.spec.ts
git commit -m "$(printf 'feat(multi-step-form): model, composed reusable schemas, createFlowForm\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 5: Presentational step components + step indicator

**Goal:** Dumb, OnPush components that each render a `FieldTree` slice and bind `[formField]`. No navigation logic.

**Files:**
- Create: `libs/tommy/multi-step-form/src/lib/steps/profile-step.ts`
- Create: `libs/tommy/multi-step-form/src/lib/steps/account-step.ts`
- Create: `libs/tommy/multi-step-form/src/lib/steps/tos-step.ts`
- Create: `libs/tommy/multi-step-form/src/lib/step-indicator.ts`
- Test: `libs/tommy/multi-step-form/src/lib/steps/steps.spec.ts`

**Acceptance Criteria:**
- [ ] Each step exposes `field = input.required<FieldTree<…>>()` and a `showErrors = input(false)`
- [ ] `ProfileStep`/`AccountStep` bind text inputs via `[formField]`; errors show after `touched()` or `showErrors()`
- [ ] `TosStep` takes `items = input.required<readonly TosItem[]>()`, iterates the TOS `FieldTree`, binds each checkbox via `[formField]`, and shows each item's title/body + required marker
- [ ] Smoke test renders each step against a real form slice without errors

**Verify:** `pnpm nx test tommy-multi-step-form` → `steps.spec.ts` passes.

**Steps:**

- [ ] **Step 1: ProfileStep**

Create `steps/profile-step.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { ProfileGroup } from '../flow-model';

@Component({
  selector: 'tommy-profile-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="space-y-4">
      @let firstName = f.firstName();
      <div>
        <label class="ui-label" for="ms-firstName">First name</label>
        <input id="ms-firstName" class="ui-input" [formField]="f.firstName" autocomplete="given-name" />
        @if ((showErrors() || firstName.touched()) && firstName.invalid()) {
          <p class="ui-error">{{ firstName.errors()[0]?.message }}</p>
        }
      </div>

      @let lastName = f.lastName();
      <div>
        <label class="ui-label" for="ms-lastName">Last name</label>
        <input id="ms-lastName" class="ui-input" [formField]="f.lastName" autocomplete="family-name" />
        @if ((showErrors() || lastName.touched()) && lastName.invalid()) {
          <p class="ui-error">{{ lastName.errors()[0]?.message }}</p>
        }
      </div>

      @let emailField = f.email();
      <div>
        <label class="ui-label" for="ms-email">Email</label>
        <input id="ms-email" type="email" class="ui-input" [formField]="f.email" autocomplete="email" />
        @if ((showErrors() || emailField.touched()) && emailField.invalid()) {
          <p class="ui-error">{{ emailField.errors()[0]?.message }}</p>
        }
      </div>
    </div>
  `,
})
export class ProfileStep {
  readonly field = input.required<FieldTree<ProfileGroup>>();
  readonly showErrors = input(false);
}
```

- [ ] **Step 2: AccountStep**

Create `steps/account-step.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { AccountGroup } from '../flow-model';

@Component({
  selector: 'tommy-account-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="space-y-4">
      @let username = f.username();
      <div>
        <label class="ui-label" for="ms-username">Username</label>
        <input id="ms-username" class="ui-input" [formField]="f.username" autocomplete="username" />
        @if ((showErrors() || username.touched()) && username.invalid()) {
          <p class="ui-error">{{ username.errors()[0]?.message }}</p>
        }
      </div>

      @let password = f.password();
      <div>
        <label class="ui-label" for="ms-password">Password</label>
        <input id="ms-password" type="password" class="ui-input" [formField]="f.password" autocomplete="new-password" />
        @if ((showErrors() || password.touched()) && password.invalid()) {
          <p class="ui-error">{{ password.errors()[0]?.message }}</p>
        }
      </div>

      @let confirm = f.confirmPassword();
      <div>
        <label class="ui-label" for="ms-confirm">Confirm password</label>
        <input id="ms-confirm" type="password" class="ui-input" [formField]="f.confirmPassword" autocomplete="new-password" />
        @if ((showErrors() || confirm.touched()) && confirm.invalid()) {
          <p class="ui-error">{{ confirm.errors()[0]?.message }}</p>
        }
      </div>
    </div>
  `,
})
export class AccountStep {
  readonly field = input.required<FieldTree<AccountGroup>>();
  readonly showErrors = input(false);
}
```

- [ ] **Step 3: TosStep (iterates the TOS field tree)**

Create `steps/tos-step.ts`:

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { TosItem } from '../flow-options';
import type { TosAck } from '../flow-model';

@Component({
  selector: 'tommy-tos-step',
  imports: [FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="space-y-3">
      @for (ack of f; track items()[i].id; let i = $index) {
        @let item = items()[i];
        @let state = ack.accepted();
        <label class="ui-card flex gap-3 items-start">
          <input type="checkbox" [formField]="ack.accepted" />
          <span>
            <span class="font-medium">{{ item.title }}</span>
            @if (item.required) { <span class="ui-error"> *</span> }
            <span class="ui-muted block">{{ item.body }}</span>
            @if ((showErrors() || state.touched()) && state.invalid()) {
              <span class="ui-error block">{{ state.errors()[0]?.message }}</span>
            }
          </span>
        </label>
      }
    </div>
  `,
})
export class TosStep {
  readonly field = input.required<FieldTree<TosAck[]>>();
  readonly items = input.required<readonly TosItem[]>();
  readonly showErrors = input(false);
}
```

> If a native `<input type="checkbox" [formField]>` does not toggle the boolean correctly on this build, replace it with spartan's checkbox component (confirm the import path/selector from the installed `@spartan-ng/helm` package recorded in Task 2) — the `[formField]` binding target (`ack.accepted`) stays the same.

- [ ] **Step 4: StepIndicator**

Create `step-indicator.ts`:

```ts
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'tommy-step-indicator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ol class="flex gap-4 mb-6">
      @for (label of labels(); track label; let i = $index) {
        <li
          class="ui-step"
          [class.ui-step-active]="i === activeIndex()"
          [class.ui-step-done]="i < activeIndex()"
        >
          <span>{{ i + 1 }}.</span><span>{{ label }}</span>
        </li>
      }
    </ol>
  `,
})
export class StepIndicator {
  readonly steps = input.required<readonly string[]>();
  readonly activeIndex = input.required<number>();
  protected readonly labels = computed(() =>
    this.steps().map((s) => s.charAt(0).toUpperCase() + s.slice(1)),
  );
}
```

- [ ] **Step 5: Smoke test the steps**

Create `steps/steps.spec.ts`:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, type FieldTree } from '@angular/forms/signals';
import type { FlowOptions } from '../flow-options';
import { emptyFlowModel, type FlowModel } from '../flow-model';
import { flowSchema } from '../flow-schema';
import { ProfileStep } from './profile-step';
import { TosStep } from './tos-step';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [
    { id: 'terms', title: 'Terms', body: 'agree', required: true },
    { id: 'news', title: 'News', body: 'optional', required: false },
  ],
};

@Component({
  imports: [ProfileStep, TosStep],
  template: `
    <tommy-profile-step [field]="form.profile" />
    <tommy-tos-step [field]="form.tos" [items]="opts.tos" />
  `,
})
class Host {
  readonly opts = OPTS;
  private readonly model = signal<FlowModel>(emptyFlowModel(OPTS));
  readonly form: FieldTree<FlowModel> = form(this.model, flowSchema(OPTS));
}

describe('step components (smoke)', () => {
  it('render against a real form slice', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('First name');
    expect(text).toContain('Terms');
    expect(text).toContain('News');
    // two checkboxes from the two TOS items
    expect((fixture.nativeElement as HTMLElement).querySelectorAll('input[type=checkbox]').length).toBe(2);
  });
});
```

- [ ] **Step 6: Run the smoke test**

```bash
pnpm nx test tommy-multi-step-form -- steps
```
Expected: PASS. (Building the form in a component field initializer gives the injection context, as in experiment #1.)

- [ ] **Step 7: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/steps libs/tommy/multi-step-form/src/lib/step-indicator.ts
git commit -m "$(printf 'feat(multi-step-form): presentational step components + indicator\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 6: `MultiStepFlow` container — phases, gated navigation, submit

**Goal:** The entry component as a phase/step state machine: start → load options → build form → step through (validity-gated) → submit via `submit()` (mapping server errors back to the username field) → done.

**Files:**
- Modify: `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`
- Modify: `libs/tommy/multi-step-form/src/lib/multi-step-flow.html`
- Modify: `libs/tommy/multi-step-form/src/lib/multi-step-flow.css`
- Test: `libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts`

**Acceptance Criteria:**
- [ ] `start()` sets phase `loading`, awaits `FlowService.loadOptions()`, builds the form with `createFlowForm`, then phase `form` at step 0 (or phase `error` on failure)
- [ ] "Next" is disabled unless the current step's slice is valid; "Back" preserves entered data (single shared model)
- [ ] On the last step, "Submit" calls `submit()`; success → phase `done` with the `confirmationId`; a `"taken"` username → server error surfaced on the account step
- [ ] `reset()` returns to the intro and clears state
- [ ] `FlowService` is provided on the component
- [ ] Smoke test: intro renders; clicking Start (with a stubbed service) advances to the profile step

**Verify:** `pnpm nx test tommy-multi-step-form` passes; `pnpm nx serve tommy-host` → manually walk intro → 3 steps → done.

**Steps:**

- [ ] **Step 1: Implement the container component**

Replace `multi-step-flow.ts`:

```ts
import { ChangeDetectionStrategy, Component, Injector, computed, inject, signal } from '@angular/core';
import { submit } from '@angular/forms/signals';
import { FlowService } from './flow.service';
import { createFlowForm, type FlowForm } from './create-flow-form';
import type { FlowOptions, FlowSubmission } from './flow-options';
import type { FlowModel } from './flow-model';
import { ProfileStep } from './steps/profile-step';
import { AccountStep } from './steps/account-step';
import { TosStep } from './steps/tos-step';
import { StepIndicator } from './step-indicator';

type Phase = 'intro' | 'loading' | 'form' | 'submitting' | 'done' | 'error';
type StepKey = 'profile' | 'account' | 'tos';
const STEPS: readonly StepKey[] = ['profile', 'account', 'tos'];

function toSubmission(model: FlowModel): FlowSubmission {
  return {
    profile: { ...model.profile },
    account: { username: model.account.username, password: model.account.password },
    acceptedTosIds: model.tos.filter((t) => t.accepted).map((t) => t.id),
  };
}

@Component({
  selector: 'tommy-multi-step-flow',
  imports: [ProfileStep, AccountStep, TosStep, StepIndicator],
  providers: [FlowService],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './multi-step-flow.html',
  styleUrl: './multi-step-flow.css',
})
export class MultiStepFlow {
  private readonly flow = inject(FlowService);
  private readonly injector = inject(Injector);

  protected readonly phase = signal<Phase>('intro');
  protected readonly options = signal<FlowOptions | null>(null);
  protected readonly flowForm = signal<FlowForm | null>(null);
  protected readonly stepIndex = signal(0);
  protected readonly confirmationId = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly submitError = signal<string | null>(null);
  protected readonly showErrors = signal(false);

  protected readonly steps = STEPS;
  protected readonly currentStep = computed(() => STEPS[this.stepIndex()]);
  protected readonly isFirst = computed(() => this.stepIndex() === 0);
  protected readonly isLast = computed(() => this.stepIndex() === STEPS.length - 1);

  /** Validity of just the active step's slice — gates "Next"/"Submit". */
  protected readonly currentStepValid = computed(() => {
    const ff = this.flowForm();
    if (!ff) return false;
    switch (this.currentStep()) {
      case 'profile': return ff.form.profile().valid();
      case 'account': return ff.form.account().valid();
      case 'tos': return ff.form.tos().valid();
    }
  });

  async start(): Promise<void> {
    this.phase.set('loading');
    this.loadError.set(null);
    try {
      const opts = await this.flow.loadOptions();
      this.options.set(opts);
      this.flowForm.set(createFlowForm(opts, this.injector));
      this.stepIndex.set(0);
      this.showErrors.set(false);
      this.phase.set('form');
    } catch {
      this.loadError.set('Could not start the sign-up flow. Please retry.');
      this.phase.set('error');
    }
  }

  next(): void {
    if (!this.currentStepValid()) { this.showErrors.set(true); return; }
    this.showErrors.set(false);
    if (!this.isLast()) this.stepIndex.update((i) => i + 1);
  }

  back(): void {
    this.showErrors.set(false);
    if (!this.isFirst()) this.stepIndex.update((i) => i - 1);
  }

  async onSubmit(): Promise<void> {
    const ff = this.flowForm();
    if (!ff) return;
    if (!this.currentStepValid()) { this.showErrors.set(true); return; }
    this.submitError.set(null);
    this.phase.set('submitting');

    await submit(ff.form, {
      action: async (field) => {
        const result = await this.flow.submitFlow(toSubmission(field().value()));
        if (result.ok) {
          this.confirmationId.set(result.confirmationId);
          return null;
        }
        // Map the server error back onto the username field.
        this.submitError.set(result.fieldErrors[0]?.message ?? 'Submission failed');
        return result.fieldErrors.map((e) => ({
          kind: 'server',
          message: e.message,
          fieldTree: field.account.username,
        }));
      },
    });

    if (this.confirmationId()) {
      this.phase.set('done');
    } else {
      // Server rejected — return to the account step with the error visible.
      this.stepIndex.set(STEPS.indexOf('account'));
      this.showErrors.set(true);
      this.phase.set('form');
    }
  }

  reset(): void {
    this.phase.set('intro');
    this.options.set(null);
    this.flowForm.set(null);
    this.stepIndex.set(0);
    this.confirmationId.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.showErrors.set(false);
  }
}
```

- [ ] **Step 2: Implement the template**

Replace `multi-step-flow.html`:

```html
<section class="ui-card space-y-4">
  @switch (phase()) {
    @case ('intro') {
      <h2 class="text-lg font-semibold">Create your account</h2>
      <p class="ui-muted">A guided, multi-step sign-up powered by Angular signal forms.</p>
      <button type="button" class="ui-btn ui-btn-primary" (click)="start()">Start</button>
    }

    @case ('loading') {
      <p class="ui-muted">Loading sign-up options…</p>
    }

    @case ('error') {
      <p class="ui-error">{{ loadError() }}</p>
      <button type="button" class="ui-btn" (click)="start()">Retry</button>
    }

    @case ('submitting') {
      <p class="ui-muted">Submitting…</p>
    }

    @case ('done') {
      <h2 class="text-lg font-semibold">🎉 All set!</h2>
      <p>Your confirmation id is <strong>{{ confirmationId() }}</strong>.</p>
      <button type="button" class="ui-btn" (click)="reset()">Start over</button>
    }

    @case ('form') {
      @if (flowForm(); as ff) {
        <tommy-step-indicator [steps]="steps" [activeIndex]="stepIndex()" />

        @switch (currentStep()) {
          @case ('profile') {
            <tommy-profile-step [field]="ff.form.profile" [showErrors]="showErrors()" />
          }
          @case ('account') {
            <tommy-account-step [field]="ff.form.account" [showErrors]="showErrors()" />
            @if (submitError()) { <p class="ui-error">{{ submitError() }}</p> }
          }
          @case ('tos') {
            <tommy-tos-step [field]="ff.form.tos" [items]="options()!.tos" [showErrors]="showErrors()" />
          }
        }

        <div class="flex justify-between pt-2">
          <button type="button" class="ui-btn" [disabled]="isFirst()" (click)="back()">Back</button>
          @if (isLast()) {
            <button type="button" class="ui-btn ui-btn-primary" [disabled]="!currentStepValid()" (click)="onSubmit()">Submit</button>
          } @else {
            <button type="button" class="ui-btn ui-btn-primary" [disabled]="!currentStepValid()" (click)="next()">Next</button>
          }
        </div>
      }
    }
  }
</section>
```

Reduce `multi-step-flow.css` to just the host block (styling now comes from `ui.css`):

```css
:host { display: block; }
```

- [ ] **Step 3: Write the container smoke test (stubbed service)**

Create `multi-step-flow.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { MultiStepFlow } from './multi-step-flow';
import { FlowService } from './flow.service';
import type { FlowOptions, FlowSubmission, SubmitResult } from './flow-options';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [{ id: 'terms', title: 'Terms', body: 'agree', required: true }],
};

class StubFlowService {
  loadOptions(): Promise<FlowOptions> { return Promise.resolve(OPTS); }
  submitFlow(_s: FlowSubmission): Promise<SubmitResult> {
    return Promise.resolve({ ok: true, confirmationId: 'SIGNUP-x' });
  }
}

describe('MultiStepFlow (smoke)', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [MultiStepFlow] })
      .overrideComponent(MultiStepFlow, { set: { providers: [{ provide: FlowService, useClass: StubFlowService }] } });
  });

  it('shows the intro, then advances to the profile step after Start', async () => {
    const fixture = TestBed.createComponent(MultiStepFlow);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Create your account');

    const startBtn = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    startBtn.click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('First name');
  });
});
```

- [ ] **Step 4: Run the test (expect PASS)**

```bash
pnpm nx test tommy-multi-step-form -- multi-step-flow
```
Expected: PASS. If `whenStable()` doesn't settle the promise + signal update, fall back to `await Promise.resolve()` then `fixture.detectChanges()`.

- [ ] **Step 5: Manual walkthrough**

```bash
pnpm nx serve tommy-host
```
Open `/multi-step-form`: Start → fill profile (Next gated) → account (try `taken`, see server error on submit; mismatch confirm blocked) → TOS (required must be ticked) → Submit → done with confirmation id → Start over.

- [ ] **Step 6: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/multi-step-flow.ts libs/tommy/multi-step-form/src/lib/multi-step-flow.html libs/tommy/multi-step-form/src/lib/multi-step-flow.css libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts
git commit -m "$(printf 'feat(multi-step-form): flow container with gated nav + submit server-error path\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

### Task 7: Verification & lib docs

**Goal:** Confirm the whole experiment builds, lints, and tests green across the workspace, and document the lib.

**Files:**
- Modify: `libs/tommy/multi-step-form/README.md`

**Acceptance Criteria:**
- [ ] `pnpm nx run-many -t lint test typecheck -p tommy-multi-step-form tommy-host` passes
- [ ] `pnpm nx build tommy-host` succeeds with a separate `multi-step-form` lazy chunk
- [ ] README documents what the experiment demonstrates, the file map, and (if taken) the spartan-ng→plain-CSS fallback decision

**Verify:** the two commands above exit 0.

**Steps:**

- [ ] **Step 1: Full check**

```bash
pnpm nx run-many -t lint test typecheck -p tommy-multi-step-form tommy-host
pnpm nx build tommy-host
```
Fix any failures before proceeding.

- [ ] **Step 2: Write the README**

Replace `libs/tommy/multi-step-form/README.md` with a short overview: the signal-forms features shown (backend-driven constraints, composed reusable schemas via `apply`/`applyEach`, cross-field validation, dynamic TOS array, `submit()` server-error mapping), the file map from this plan, the test command (`pnpm nx test tommy-multi-step-form`), and a one-line note on whether spartan-ng or the plain-CSS fallback was used.

- [ ] **Step 3: Commit**

```bash
git add libs/tommy/multi-step-form/README.md
git commit -m "$(printf 'docs(multi-step-form): document experiment + verify full build/test\n\nCo-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>')"
```

---

## Self-Review

**Spec coverage:** intro/load (Tasks 3,6) · profile/account/tos steps (Tasks 4,5,6) · backend-driven constraints (Task 4 `accountSchema(opts)`) · cross-field (Task 4) · dynamic TOS array (Tasks 4,5) · `submit()` server-error path (Tasks 3,6) · composed reusable schemas (Task 4) · component-swap navigation (Task 6) · host registration (Task 1) · styling + fallback (Task 2) · logic-first tests (Tasks 3–6) · out-of-scope items untouched. ✓ No spec requirement is unimplemented.

**Placeholder scan:** No "TBD/TODO". The two `>` contingency notes (applyEach PathKind; checkbox fallback) include complete alternative code, not vague instructions. ✓

**Type consistency:** `FlowOptions`/`TosItem`/`FlowSubmission`/`SubmitResult` (Task 3) reused verbatim in Tasks 4/6. `FlowModel`/`ProfileGroup`/`AccountGroup`/`TosAck` (Task 4) reused in Tasks 5/6. `createFlowForm(opts, injector) → { model, form }` (Task 4) consumed in Task 6. `FlowForm` type shared. `ui-*` class names (Task 2) referenced by all components. `STEPS`/`StepKey`/`Phase` are container-local. ✓
