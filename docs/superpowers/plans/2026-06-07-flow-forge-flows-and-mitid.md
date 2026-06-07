# Flow Forge — Insurance & Bank Flows + Cross-Origin MitID (Plan 2 of 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the Flow Forge experiment by adding the two remaining flows — "insurance" (complex fields: dynamic array, conditional reveal, cross-field) and "bank" (real cross-origin MitID signing) — plus a standalone `mock-idp` app, exercising the engine's 202 step-up end-to-end with no engine contract changes.

**Architecture:** The engine from Plan 1 is reused unchanged in contract; the only engine *enhancement* is a resume entry point on `<flow-runner>` (rebuild the form from the persisted snapshot and re-submit with the MitID `code`). The launcher's existing `handleCallback` is extended from "open the flow" to "rehydrate → re-submit". A new minimal Nx app (`apps/tommy/mock-idp`, separate origin/port 4300) plays the MitID provider: it reads `challenge`/`state`/`return`, shows Approve/Cancel, and redirects back to the host callback echoing `state` + a one-time `code`. Two new flows are pure content (model + schema + steps + fixture + def), registered in `flow-registry.ts`.

**Tech Stack:** Angular 21.2.x (zoneless), `@angular/forms/signals` (signal forms), `@angular/cdk`, Nx 22.7.5, Vitest (`vitest-analog`), Tailwind v4 `.ui-*` layer, pnpm 10.

**Spec:** `docs/superpowers/specs/2026-06-07-flow-forge-complex-multi-step-design.md`
**Plan 1 (already merged):** `docs/superpowers/plans/2026-06-07-flow-forge-engine.md` — the engine, host gallery, and newsletter flow are on `main`.

**Reference (read before implementing):**
- `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts` — the runner you extend (resume).
- `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts` — the launcher you extend (callback → resume).
- `libs/tommy/signal-forms/flow-forge/src/lib/engine/{flow-def.ts,flow-backend.ts,flow-state-store.ts,mitid.ts}` — contracts/seams.
- `libs/tommy/signal-forms/flow-forge/src/lib/flows/newsletter/**` and `steps/tos-step.ts` — the flow + shared-step patterns to mirror.
- `libs/tommy/signal-forms/multi-step-form/src/lib/model/flow-schema.ts` — the proven `applyEach`/`validate`/cross-field signal-forms patterns.

---

## File Structure

```
libs/tommy/signal-forms/flow-forge/src/lib/
  engine/
    resume.ts                       → ResumeData type ({ model, signature })
    flow-runner.ts                  → MODIFY: resume input + ngOnInit + resumeAndSubmit + optional-signature onSubmit + focus-on-step-change
    flow-runner.html                → MODIFY: a 'resuming' branch
    mitid.ts                        → MODIFY: + MOCK_IDP_ORIGIN constant
  flow-forge.ts                     → MODIFY: handleCallback computes resumeData on approved+matching state
  flow-forge.html                   → MODIFY: bind [resume] on <tommy-flow-runner>
  flow-registry.ts                  → MODIFY: register bank + insurance
  flows/
    bank/                           → model.ts schema.ts fixtures.ts steps/{applicant-step.ts,account-type-step.ts} def.ts (+ specs)
    insurance/                      → model.ts schema.ts fixtures.ts steps/{policy-step.ts,incident-step.ts,items-step.ts} def.ts (+ specs)

apps/tommy/mock-idp/                → NEW Nx app: Approve/Cancel provider on port 4300

README.md                          → MODIFY: run both apps, Vercel note, 3 flows
libs/tommy/signal-forms/flow-forge/README.md → MODIFY: flows now 3; mock-idp round-trip wired
```

---

### Task 1: Engine — runner resume + optional-signature submit + focus-on-step-change

**Goal:** `<flow-runner>` can resume a flow from a persisted snapshot and complete the MitID submission, and moves focus to the step container on step change (a11y). No `FlowDef` contract change.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/engine/resume.ts`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.html`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts`

**Acceptance Criteria:**
- [ ] With a `resume` input set, on init the runner re-fetches options, rebuilds the form, restores the snapshot model, and re-submits passing the `signature` — an `ok` outcome lands on `done` with the confirmation id.
- [ ] A `resuming` view ("Completing your MitID signing…") shows while the resume submit is in flight (not the intro Start button).
- [ ] `onSubmit(signature?)` forwards an optional signature to `backend.submit`; the no-arg call (template Submit button) is unchanged.
- [ ] On step change, the step container receives focus via `afterNextRender` (zoneless-safe). Existing rendering/submit tests still pass.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → resume cases pass; all existing pass. `pnpm nx build tommy-host` → AOT passes.

**Steps:**

- [ ] **Step 1: Create the resume type `resume.ts`.**

```ts
import type { Signature } from './flow-def';

/** Data the launcher hands a runner to complete a flow after a MitID round-trip. */
export interface ResumeData {
  /** The serialized model from the pre-redirect snapshot (already `def.snapshot`-shaped). */
  readonly model: unknown;
  /** The MitID proof: challenge id + the one-time code returned by the provider. */
  readonly signature: Signature;
}
```

- [ ] **Step 2: Write the failing resume test (append to `flow-runner.spec.ts`).**

Reuse the existing `testFlow` (its `toSubmission` returns the model, its `buildForm` builds a 2-field model). Add a fixture whose `submit` returns `ok` ONLY when a signature is present (mirrors a completed signing), and mount the runner with a `resume` input.

```ts
import type { ResumeData } from './resume';

async function setupResume(resume: ResumeData) {
  const submit = (_p: unknown, signature?: { code: string }) =>
    signature
      ? { status: 'ok', httpStatus: 200, confirmationId: 'SIGNED-1' }
      : { status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/x', challengeId: 'c' };
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [FlowBackend, FlowStateStore, { provide: FLOW_FIXTURES, useValue: new Map([['test', { features: {}, terms: {}, submit }]]) }],
  });
  const fixture = TestBed.createComponent(FlowRunner);
  fixture.componentRef.setInput('def', testFlow);
  fixture.componentRef.setInput('resume', resume);
  fixture.detectChanges();
  return fixture;
}

describe('FlowRunner — resume after MitID', () => {
  it('rebuilds the form, re-submits with the signature, and lands on done', async () => {
    const fixture = await setupResume({
      model: { one: { name: 'Tom' }, two: { city: 'CPH' } },
      signature: { challengeId: 'c', code: 'otc-1' },
    });
    // wait out the loadOptions (500ms) + submit (500ms) real delays
    await new Promise((r) => setTimeout(r, 1300));
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('All set');
    expect(el.textContent).toContain('SIGNED-1');
  });
});
```
Run `pnpm nx test tommy-signal-forms-flow-forge`; confirm FAIL (`resume` input doesn't exist / no resume behavior).

- [ ] **Step 3: Add the resume input + lifecycle + helper to `flow-runner.ts`.**

Add imports at the top:
```ts
import { ChangeDetectionStrategy, Component, ElementRef, Injector, afterNextRender, computed, effect, inject, input, signal, viewChild, type OnInit } from '@angular/core';
import type { Signature } from './flow-def';
import type { ResumeData } from './resume';
```
(Keep the existing imports; ensure `OnInit`, `afterNextRender`, `effect`, `viewChild`, `ElementRef`, `Signature`, `ResumeData` are present.)

Change the class declaration to implement `OnInit`:
```ts
export class FlowRunner implements OnInit {
```

Add the resume input + a resuming signal (near the other signals):
```ts
  readonly resume = input<ResumeData | null>(null);
  protected readonly resuming = signal(false);
```

Add `ngOnInit` (kick off resume if provided):
```ts
  ngOnInit(): void {
    const r = this.resume();
    if (r) void this.resumeAndSubmit(r);
  }
```

Refactor `onSubmit` to accept an optional signature and pass it to the backend. Change the signature line and the backend call:
```ts
  async onSubmit(signature?: Signature): Promise<void> {
    const ff = this.flowForm();
    if (!ff) return;
    const state = this.currentStepState();
    if (!state || !this.wizard().validateCurrent(state)) return;
    // ... unchanged setup ...
        action: async (field) => {
          const payload = this.def().toSubmission(field().value());
          const outcome = await this.backend.submit(this.def().meta.slug, payload, signature);
          // ... rest unchanged ...
```
(Only two edits: add the `signature?: Signature` param, and add `, signature` to the `this.backend.submit(...)` call. The template still calls `onSubmit()` with no arg — unchanged.)

Add the resume helper (rebuild form from snapshot, re-submit with the code):
```ts
  /**
   * Complete a flow after returning from MitID: re-fetch options (the GET is
   * idempotent; SPA state was destroyed by the full-page redirect), rebuild the
   * form, restore the persisted model, jump to the final step, and re-submit with
   * the signature. An `ok` lands on `done`; a `rejected` surfaces on the last step.
   */
  private async resumeAndSubmit(r: ResumeData): Promise<void> {
    this.resuming.set(true);
    try {
      const env = await this.backend.loadOptions(this.def().meta.slug);
      this.env.set(env);
      const ff = this.def().buildForm(env, this.injector);
      const restored = this.def().restore ? this.def().restore!(r.model) : r.model;
      ff.model.set(restored as never);
      this.flowForm.set(ff);
      this.wizard().stepIndex.set(this.def().steps.length - 1);
      this.wizard().phase.set('form');
    } catch (e) {
      if (typeof ngDevMode !== 'undefined' && ngDevMode) console.error('[flow-forge] resume load failed', e);
      this.loadError.set('Could not complete your signing. Please retry.');
      this.resuming.set(false);
      this.wizard().phase.set('intro');
      return;
    }
    this.resuming.set(false);
    await this.onSubmit(r.signature);
  }
```

Add focus-on-step-change. Add a view child for the step region and an effect that focuses it after render when the step index changes:
```ts
  private readonly stepRegion = viewChild<ElementRef<HTMLElement>>('stepRegion');

  constructor() {
    // Move focus to the active step region on each step change (zoneless: defer to
    // afterNextRender so the DOM for the new step exists before we focus).
    effect(() => {
      this.wizard().stepIndex();              // track step changes
      if (this.wizard().phase() !== 'form') return;
      afterNextRender(
        () => this.stepRegion()?.nativeElement.focus(),
        { injector: this.injector },
      );
    });
  }
```
NOTE: `afterNextRender` must run in an injection context — pass `{ injector: this.injector }` since it's called inside an `effect` callback (not the constructor's top level). Verify this is accepted by the installed Angular 21.2.x API; if `afterNextRender` requires being called directly in an injection context, instead register ONE `afterNextRender` in the constructor that reads a "focus requested" signal, and have the effect set that signal. Use whatever the real API supports — the a11y behavior (focus the new step) is the contract; keep it zoneless-safe (no `setTimeout`-based focus).

- [ ] **Step 4: Update `flow-runner.html`.**

Wrap the shell with a resuming branch, and add the focusable step region wrapper around the dynamic step. Replace the form-phase step area so the `NgComponentOutlet` sits inside a focusable container:

At the very top of the template, before `<tommy-flow-shell>`:
```html
@if (resuming()) {
  <tommy-flow-shell>
    <h2 class="ui-title">Completing your MitID signing…</h2>
    <p class="ui-muted"><span class="ui-spinner" aria-hidden="true"></span> Verifying your signature.</p>
  </tommy-flow-shell>
} @else {
```
…then the existing `<tommy-flow-shell>…</tommy-flow-shell>` block…, and close with `}` at the very end.

Inside the `@case ('form')` block, wrap the step outlet in a focusable region:
```html
  <div #stepRegion tabindex="-1" class="ui-stack">
    <ng-container [ngComponentOutlet]="currentStepDef().component" [ngComponentOutletInputs]="stepInputs()" />
  </div>
```
(Keep the step-indicator + error-banner above it and the submitError + nav row below, as-is.)

- [ ] **Step 5: Run tests + AOT build.**

Run: `pnpm nx test tommy-signal-forms-flow-forge`
Expected: the new resume test PASSES; all existing runner/render/submit tests still PASS.
Run: `pnpm nx build tommy-host`
Expected: AOT succeeds (the host already lazy-loads the runner via the launcher).

- [ ] **Step 6: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/resume.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.html \
        libs/tommy/signal-forms/flow-forge/src/lib/engine/flow-runner.spec.ts
git commit -m "feat(flow-forge): runner resume after MitID + optional-signature submit + focus-on-step-change"
```

---

### Task 2: Launcher — approved callback rehydrates and resumes

**Goal:** On an approved MitID callback with a matching `state`, the launcher hands the runner a `resume` payload (snapshot model + the one-time `code`) so the flow completes; cancelled/mismatch behavior is unchanged.

**Files:**
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.html`
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.spec.ts`

**Acceptance Criteria:**
- [ ] On `?mitid=callback&flow=<slug>&status=approved&state=<S>&code=<C>` with a stored snapshot whose `state` is `<S>`, the launcher selects the flow AND passes a `resume` (`{ model: snap.model, signature: { challengeId: snap.challengeId, code: <C> } }`) to `<tommy-flow-runner>`.
- [ ] On `status=cancelled` (matching state), the flow is selected with a "Signing cancelled" notice and NO resume (the user can review/resubmit manually).
- [ ] A non-matching/absent state still ignores the callback (gallery shown), unchanged.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → launcher tests pass; `pnpm nx build tommy-host` → AOT passes.

**Steps:**

- [ ] **Step 1: Write the failing test (append to `flow-forge.spec.ts`).**

Seed a snapshot with a known `state`, mount with an approved callback carrying a matching `state` + a `code`, and assert the runner is mounted with a non-null `resume` input. Because the runner's resume kicks off async work, assert the binding by reading the mounted runner's `resume` input via its debug element, OR assert the resulting runner shows the "Completing your MitID signing…" text (resuming branch) synchronously after detectChanges.

```ts
it('approved callback with matching state resumes the runner', () => {
  const store = new FlowStateStore();
  store.save({ flowSlug: 'newsletter', schemaVersion: 1, state: 'S1', challengeId: 'ch', model: { contact: { name: 'T', email: 't@e.com' }, prefs: { frequency: 'weekly' }, tos: [] } });
  const fixture = mount(routeWith({ mitid: 'callback', flow: 'newsletter', status: 'approved', state: 'S1', code: 'otc-1' }));
  const el = fixture.nativeElement as HTMLElement;
  expect(el.querySelector('tommy-flow-runner')).not.toBeNull();
  // resuming branch renders synchronously (ngOnInit set resuming=true before the async load resolves)
  expect(el.textContent).toContain('Completing your MitID signing');
});
```
NOTE: confirm the newsletter `schemaVersion` is 1. The `model` shape must match `NewsletterModel`. Use the existing `mount`/`routeWith` helpers. Run `pnpm nx test tommy-signal-forms-flow-forge`; confirm FAIL (launcher doesn't pass `resume`, so no resuming branch).

- [ ] **Step 2: Extend `handleCallback` in `flow-forge.ts`.**

Add a `resumeData` signal and import the type:
```ts
import type { ResumeData } from './engine/resume';
// ...
  protected readonly resumeData = signal<ResumeData | null>(null);
```
Replace the body of `handleCallback` after the state check with:
```ts
  private handleCallback(): void {
    const cb = parseCallback(this.route.snapshot.queryParamMap);
    if (cb.mitid !== 'callback' || !cb.flow) return;
    const def = FLOWS.find((f) => f.meta.slug === cb.flow);
    if (!def) return;
    const snap = this.store.restore(def.meta.slug, def.schemaVersion); // single-use
    if (!snap || !cb.state || snap.state !== cb.state) return; // correlation/replay check
    this.selected.set(def);
    if (cb.status === 'approved' && cb.code) {
      this.resumeData.set({ model: snap.model, signature: { challengeId: snap.challengeId, code: cb.code } });
    } else {
      this.returnNotice.set('Signing cancelled — you can review and resubmit.');
    }
  }
```
Clear `resumeData` in `select()` (a fresh manual selection isn't a resume):
```ts
  select(def: AnyFlowDef): void {
    this.returnNotice.set(null);
    this.resumeData.set(null);
    this.selected.set(def);
  }
```

- [ ] **Step 3: Bind `[resume]` in `flow-forge.html`.**

Change the runner line:
```html
  <tommy-flow-runner [def]="def" [resume]="resumeData()" />
```

- [ ] **Step 4: Run tests + AOT build.**

Run: `pnpm nx test tommy-signal-forms-flow-forge` → launcher tests PASS (incl. the new approved-resume test + the existing cancelled/mismatch tests).
Run: `pnpm nx build tommy-host` → AOT passes.

- [ ] **Step 5: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.html \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-forge.spec.ts
git commit -m "feat(flow-forge): launcher rehydrates + resumes runner on approved MitID callback"
```

---

### Task 3: The `mock-idp` provider app

**Goal:** A standalone Nx Angular app on its own origin (dev port 4300) that plays the MitID provider: reads `challenge`/`state`/`return`, shows Approve/Cancel, validates the `return` origin, and redirects back with `status` + echoed `state` + a one-time `code`.

**Files:**
- Create: `apps/tommy/mock-idp/**` (via generator)
- Modify: `apps/tommy/mock-idp/src/app/app.ts` (the provider component) + its template/styles
- Test: `apps/tommy/mock-idp/src/app/app.spec.ts`

**Acceptance Criteria:**
- [ ] `pnpm nx serve tommy-mock-idp` serves on port 4300.
- [ ] The component reads `challenge`, `state`, `return` from the URL; renders Approve + Cancel buttons and the challenge id.
- [ ] Approve builds `<return>&status=approved&state=<state>&code=<uuid>` (only if `return` origin is in the allow-list); Cancel builds `<return>&status=cancelled&state=<state>`. The redirect goes through an injectable seam so it's unit-testable without navigating.
- [ ] A `return` whose origin is not allow-listed is rejected (no redirect; an error shown).

**Verify:** `pnpm nx test tommy-mock-idp` → app spec passes; `pnpm nx build tommy-mock-idp` → succeeds.

**Steps:**

- [ ] **Step 1: Scaffold the app via the nx-generate skill** (per `CLAUDE.md`, invoke `nx-generate` first; don't guess flags). Intended generator (workspace defaults: `@nx/angular:application` → e2eTestRunner none, style css, vitest-analog):
```bash
pnpm nx g @nx/angular:application mock-idp --directory=apps/tommy/mock-idp --prefix=tommy --tags=scope:tommy,type:app --no-interactive
```
Confirm `apps/tommy/mock-idp/project.json` resembles `apps/tommy/host/project.json` (app, prefix `tommy`, tags). Set the dev-server port to 4300: in `project.json`'s `serve` target options add `"port": 4300` (match the host's `serve` target shape — it uses `@angular/build:dev-server`; the `port` option goes under the target `options`, or under `configurations.development` — verify against the host and the builder schema; do not guess).

- [ ] **Step 2: Write the failing app spec `apps/tommy/mock-idp/src/app/app.spec.ts`.**

```ts
import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { Redirect } from './redirect';

class FakeRedirect { last: string | null = null; go(u: string) { this.last = u; } }

function mount(query: string, redirect: FakeRedirect) {
  // App reads window.location.search; stub it via a provided token (see impl).
  TestBed.configureTestingModule({
    imports: [App],
    providers: [{ provide: Redirect, useValue: redirect }, { provide: 'QUERY', useValue: query }],
  });
  const f = TestBed.createComponent(App);
  f.detectChanges();
  return f;
}

describe('mock-idp App', () => {
  const ret = encodeURIComponent('http://localhost:4200/flow-forge?mitid=callback&flow=bank');
  it('approve redirects back with approved + state + code (allowed origin)', () => {
    const r = new FakeRedirect();
    const f = mount(`?challenge=ch1&state=S1&return=${ret}`, r);
    const el = f.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => /approve/i.test(b.textContent ?? '')) as HTMLButtonElement).click();
    expect(r.last).toContain('status=approved');
    expect(r.last).toContain('state=S1');
    expect(r.last).toMatch(/code=/);
    expect(r.last).toContain('http://localhost:4200/flow-forge');
  });
  it('cancel redirects back with cancelled + state', () => {
    const r = new FakeRedirect();
    const f = mount(`?challenge=ch1&state=S1&return=${ret}`, r);
    const el = f.nativeElement as HTMLElement;
    (Array.from(el.querySelectorAll('button')).find((b) => /cancel/i.test(b.textContent ?? '')) as HTMLButtonElement).click();
    expect(r.last).toContain('status=cancelled');
    expect(r.last).toContain('state=S1');
  });
  it('rejects a return URL whose origin is not allow-listed', () => {
    const r = new FakeRedirect();
    const f = mount(`?challenge=ch1&state=S1&return=${encodeURIComponent('http://evil.example/x')}`, r);
    const el = f.nativeElement as HTMLElement;
    const approve = Array.from(el.querySelectorAll('button')).find((b) => /approve/i.test(b.textContent ?? '')) as HTMLButtonElement | undefined;
    approve?.click();
    expect(r.last).toBeNull();
    expect(el.textContent?.toLowerCase()).toContain('invalid');
  });
});
```
Run `pnpm nx test tommy-mock-idp`; confirm FAIL.

- [ ] **Step 3: Implement the redirect seam `apps/tommy/mock-idp/src/app/redirect.ts`.**
```ts
import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class Redirect {
  go(url: string): void {
    window.location.href = url;
  }
}
```

- [ ] **Step 4: Implement the provider component `apps/tommy/mock-idp/src/app/app.ts`.**

```ts
import { ChangeDetectionStrategy, Component, Optional, Inject, computed, inject, signal } from '@angular/core';
import { Redirect } from './redirect';

/** Origins this mock IdP is allowed to return users to (no open redirect). */
const ALLOWED_RETURN_ORIGINS = ['http://localhost:4200'];

@Component({
  selector: 'tommy-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="idp">
      <h1>MitID <span class="mock">(mock)</span></h1>
      @if (invalid()) {
        <p class="err">Invalid sign-in request.</p>
      } @else {
        <p>Authorize signing for challenge <strong>{{ challenge() }}</strong>?</p>
        <div class="row">
          <button type="button" class="approve" (click)="approve()">Approve & sign</button>
          <button type="button" class="cancel" (click)="cancel()">Cancel</button>
        </div>
      }
    </main>
  `,
  styles: [`
    .idp { max-width: 28rem; margin: 4rem auto; font-family: system-ui, sans-serif; text-align: center; }
    h1 { color: #0a3d91; } .mock { color: #888; font-size: .6em; }
    .row { display: flex; gap: .75rem; justify-content: center; margin-top: 1.5rem; }
    button { padding: .6rem 1rem; border-radius: 8px; border: 1px solid #ccc; cursor: pointer; }
    .approve { background: #0a3d91; color: #fff; border-color: #0a3d91; }
    .err { color: #b00; }
  `],
})
export class App {
  private readonly redirect = inject(Redirect);
  private readonly query: string;

  constructor(@Optional() @Inject('QUERY') query?: string) {
    this.query = query ?? window.location.search;
  }

  private params = new URLSearchParams(this.query);
  protected readonly challenge = signal(this.params.get('challenge') ?? '');
  private readonly state = this.params.get('state') ?? '';
  private readonly returnUrl = this.params.get('return') ?? '';
  protected readonly invalid = computed(() => !this.returnAllowed());

  private returnAllowed(): boolean {
    try {
      return ALLOWED_RETURN_ORIGINS.includes(new URL(this.returnUrl).origin);
    } catch {
      return false;
    }
  }

  approve(): void {
    if (!this.returnAllowed()) return;
    const code = crypto.randomUUID();
    this.redirect.go(`${this.returnUrl}&status=approved&state=${encodeURIComponent(this.state)}&code=${encodeURIComponent(code)}`);
  }

  cancel(): void {
    if (!this.returnAllowed()) return;
    this.redirect.go(`${this.returnUrl}&status=cancelled&state=${encodeURIComponent(this.state)}`);
  }
}
```
NOTE: the generator may produce `App` differently (e.g. a `app.ts` with a different selector or a separate `app.config.ts`/`main.ts`). Keep the bootstrap the generator created; just make the root component the provider above (adjust selector to whatever `index.html` bootstraps). The `'QUERY'` injection token lets tests inject a query string; in production it falls back to `window.location.search`. If you prefer a typed `InjectionToken<string>` over the string token, define one in `redirect.ts` and use it in both the component and the spec — just keep it consistent.

- [ ] **Step 5: Run tests + build.**

Run: `pnpm nx test tommy-mock-idp` → 3 specs PASS.
Run: `pnpm nx build tommy-mock-idp` → succeeds.
(Optional sanity: `pnpm nx serve tommy-mock-idp` and confirm it serves on 4300, then stop it.)

- [ ] **Step 6: Commit.**

```bash
git add apps/tommy/mock-idp
git commit -m "feat(mock-idp): cross-origin MitID provider app (approve/cancel + return-origin guard)"
```

---

### Task 4: The bank flow (in-context MitID signing)

**Goal:** A flow whose backend demands MitID signing — its fixture returns 202 (pointing at the mock-idp) on first submit and 200 once a signature is present — driving the engine's full step-up round-trip.

**Files:**
- Modify: `libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.ts` (+ `MOCK_IDP_ORIGIN`)
- Create: `flows/bank/{model.ts,schema.ts,fixtures.ts,steps/applicant-step.ts,steps/account-type-step.ts,def.ts}`
- Test: `flows/bank/{schema.spec.ts,fixtures.spec.ts}`
- Modify: `flow-registry.ts` (register bank)

**Acceptance Criteria:**
- [ ] The schema requires the applicant fields + a chosen account type, and requires accepting each required term.
- [ ] The fixture's `submit` returns 202 `signing_required` with `signingUrl` on the `MOCK_IDP_ORIGIN` (carrying the `challengeId`) when no signature, and 200 `ok` with a confirmation id when a signature is present.
- [ ] `bankFlow` is a complete `FlowDef` (applicant → account-type → tos), registered in `flow-registry.ts` + `FIXTURES`.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → bank specs pass; `pnpm nx build tommy-host` → AOT passes.

**Steps:**

- [ ] **Step 1: Add `MOCK_IDP_ORIGIN` to `engine/mitid.ts`.**
```ts
/**
 * Origin of the mock MitID provider app (`apps/tommy/mock-idp`, dev port 4300).
 * The bank fixture points its 202 `signingUrl` here. In production this needs a
 * deployed provider origin; absent one, the bank flow's redirect cannot complete
 * (dev-only / degrades — see README).
 */
export const MOCK_IDP_ORIGIN = 'http://localhost:4300';
```

- [ ] **Step 2: Write the failing fixture spec `flows/bank/fixtures.spec.ts`.**
```ts
import { bankFixture } from './fixtures';

describe('bank fixture submit', () => {
  it('returns 202 signing_required pointing at the mock idp when unsigned', () => {
    const out = bankFixture.submit({});
    expect(out.status).toBe('signing_required');
    if (out.status === 'signing_required') {
      expect(out.httpStatus).toBe(202);
      expect(out.signingUrl).toContain('localhost:4300');
      expect(out.signingUrl).toContain(out.challengeId);
    }
  });
  it('returns 200 ok once a signature is present', () => {
    const out = bankFixture.submit({}, { challengeId: 'c', code: 'otc' });
    expect(out.status).toBe('ok');
    if (out.status === 'ok') expect(out.confirmationId).toMatch(/^BANK-/);
  });
});
```
And the schema spec `flows/bank/schema.spec.ts`:
```ts
import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { bankFlow } from './def';
import type { FlowEnvelope } from '../../engine/flow-def';

const env: FlowEnvelope = {
  features: { FULL_NAME: { mandatory: true }, CPR: { mandatory: true }, ACCOUNT_TYPE: { mandatory: true } },
  terms: { tos: { title: 'Terms', body: 'b', required: true } },
};
const build = () => bankFlow.buildForm(env, TestBed.inject(Injector));

describe('bank schema', () => {
  it('requires applicant fields and an account type', () => {
    const { form } = build();
    expect(form.applicant.fullName().valid()).toBe(false);
    form.applicant.fullName().value.set('Tove Hansen');
    form.applicant.cpr().value.set('0101901234');
    expect(form.applicant().valid()).toBe(true);
    expect(form.account.accountType().valid()).toBe(false); // empty default
    form.account.accountType().value.set('standard');
    expect(form.account.accountType().valid()).toBe(true);
  });
});
```
Run `pnpm nx test tommy-signal-forms-flow-forge`; confirm FAIL.

NOTE: verify the exact value-setter API (`field().value.set(...)`) against the newsletter `schema.spec.ts` already in the repo, and mirror it. Adjust the account-type "empty default" assumption if you default it differently — the contract is "account type must be chosen".

- [ ] **Step 3: Implement `flows/bank/model.ts`.**
```ts
import type { FlowEnvelope } from '../../engine/flow-def';
import { tosAcksFrom, type TosAck } from '../../steps/tos-step';

export type AccountType = '' | 'standard' | 'student' | 'business';

export interface BankModel {
  applicant: { fullName: string; cpr: string; address: string };
  account: { accountType: AccountType };
  tos: TosAck[];
}

export function emptyModel(env: FlowEnvelope): BankModel {
  return {
    applicant: { fullName: '', cpr: '', address: '' },
    account: { accountType: '' },
    tos: tosAcksFrom(env.terms),
  };
}
```

- [ ] **Step 4: Implement `flows/bank/schema.ts`** (use the shared `applyFeature` for the mandatory text fields; mirror newsletter's tos `applyEach`).
```ts
import { apply, applyEach, required, schema, validate } from '@angular/forms/signals';
import { applyFeature } from '../../engine/schema-helpers';
import type { FlowEnvelope } from '../../engine/flow-def';
import type { BankModel } from './model';

export function bankSchema(env: FlowEnvelope) {
  return schema<BankModel>((p) => {
    apply(
      p.applicant,
      schema((a) => {
        applyFeature(a.fullName, env.features['FULL_NAME'] ?? { mandatory: true }, { requiredMessage: 'Full name is required' });
        applyFeature(a.cpr, env.features['CPR'] ?? { mandatory: true }, { requiredMessage: 'CPR number is required' });
      }),
    );
    // Account type: a non-empty selection is required.
    validate(p.account.accountType, (ctx) => (ctx.value() ? null : { kind: 'required', message: 'Choose an account type' }));
    applyEach(p.tos, (item) =>
      validate(item.accepted, (ctx) => (ctx.valueOf(item.required) && !ctx.value() ? { kind: 'mustAccept', message: 'You must accept this to continue' } : null)),
    );
  });
}
```
NOTE: `applyFeature`'s path param is typed `SchemaPath<string, ...>` — `a.fullName`/`a.cpr` are string paths, so it fits. Verify against the `schema-helpers.ts` signature already in the repo.

- [ ] **Step 5: Implement `flows/bank/fixtures.ts`.**
```ts
import type { FlowFixture } from '../../engine/flow-backend';
import type { FeatureDescriptor, SubmitOutcome } from '../../engine/flow-def';
import { MOCK_IDP_ORIGIN } from '../../engine/mitid';

export type BankFeatures = { FULL_NAME: FeatureDescriptor; CPR: FeatureDescriptor; ACCOUNT_TYPE: FeatureDescriptor };

export const bankFixture: FlowFixture<BankFeatures> = {
  features: { FULL_NAME: { mandatory: true }, CPR: { mandatory: true }, ACCOUNT_TYPE: { mandatory: true } },
  terms: {
    tos: { title: 'Account Terms', body: 'You agree to the account terms and conditions.', required: true },
    datashare: { title: 'Data sharing', body: 'Share anonymised usage data (optional).', required: false },
  },
  submit: (payload, signature): SubmitOutcome => {
    if (!signature) {
      const challengeId = 'bank-' + (payload as { applicant?: { cpr?: string } }).applicant?.cpr?.slice(-4) ?? 'xxxx';
      return {
        status: 'signing_required',
        httpStatus: 202,
        signingUrl: `${MOCK_IDP_ORIGIN}/?challenge=${encodeURIComponent(challengeId)}`,
        challengeId,
      };
    }
    return { status: 'ok', httpStatus: 200, confirmationId: `BANK-${signature.challengeId}` };
  },
};
```
NOTE: the `challengeId` derivation above mixes `??` and `+` (precedence) — write it clearly: compute `const last4 = (payload as ...).applicant?.cpr?.slice(-4) ?? 'xxxx'; const challengeId = 'bank-' + last4;`. Fix to that explicit form.

- [ ] **Step 6: Implement the two step components.**

`flows/bank/steps/applicant-step.ts` (mirror newsletter `contact-step.ts`: text fields fullName/cpr/address, each with `tommy-field-error`). `flows/bank/steps/account-type-step.ts` (a radio group like newsletter `prefs-step.ts`, options `standard|student|business`, bound `[formField]="f.accountType"`, plus a `tommy-field-error` for the required selection). Both `implements StepComponent<Slice>` with `field`/`showErrors` inputs, OnPush, `imports: [FormField, FieldError]`. Write them complete, following the newsletter step components exactly in structure.

- [ ] **Step 7: Implement `flows/bank/def.ts`** (mirror newsletter `def.ts`).
```ts
import { Injector, runInInjectionContext, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { defineStep, type FlowDef, type FlowEnvelope } from '../../engine/flow-def';
import { TosStep, type TosAck } from '../../steps/tos-step';
import { emptyModel, type BankModel } from './model';
import { bankSchema } from './schema';
import { ApplicantStep } from './steps/applicant-step';
import { AccountTypeStep } from './steps/account-type-step';

export const bankFlow: FlowDef<BankModel> = {
  meta: {
    slug: 'bank',
    title: 'Open a bank account',
    blurb: 'Apply, then sign with MitID to finish — the in-context signing flow.',
    intro: 'Open a new account. You will confirm with MitID before we create it.',
    dimension: 'signing',
  },
  schemaVersion: 1,
  buildForm: (env: FlowEnvelope, injector: Injector) => {
    const model = signal<BankModel>(emptyModel(env));
    const tree = runInInjectionContext(injector, () => form(model, bankSchema(env)));
    return { model, form: tree };
  },
  steps: [
    defineStep<BankModel, BankModel['applicant']>({ key: 'applicant', label: 'Applicant', component: ApplicantStep, field: (f) => f.applicant }),
    defineStep<BankModel, BankModel['account']>({ key: 'account', label: 'Account', component: AccountTypeStep, field: (f) => f.account }),
    defineStep<BankModel, TosAck[], FlowEnvelope['terms']>({ key: 'tos', label: 'Terms', component: TosStep, field: (f) => f.tos, data: (env) => env.terms }),
  ],
  toSubmission: (m) => ({ applicant: m.applicant, accountType: m.account.accountType, acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id) }),
};
```
NOTE: `account` step's `field` is `f.account` (the group), but the account-type step binds `f.accountType` inside — the slice type is `BankModel['account']` so the component reads `field().accountType`. Make the AccountTypeStep read `field().accountType` accordingly.

- [ ] **Step 8: Register bank in `flow-registry.ts`.**
```ts
import { bankFlow } from './flows/bank/def';
import { bankFixture } from './flows/bank/fixtures';
// ...
export const FLOWS: readonly AnyFlowDef[] = [newsletterFlow as AnyFlowDef, bankFlow as AnyFlowDef];
export const FIXTURES = new Map<string, FlowFixture>([
  ['newsletter', newsletterFixture as FlowFixture],
  ['bank', bankFixture as FlowFixture],
]);
```

- [ ] **Step 9: Run tests + AOT build.**

Run: `pnpm nx test tommy-signal-forms-flow-forge` → bank schema + fixture specs PASS; all existing PASS.
Run: `pnpm nx build tommy-host` → AOT compiles the bank step templates (gallery now shows 2 flows).

- [ ] **Step 10: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.ts \
        libs/tommy/signal-forms/flow-forge/src/lib/flows/bank \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-registry.ts
git commit -m "feat(flow-forge): bank flow with MitID 202 step-up (points at mock-idp)"
```

---

### Task 5: The insurance flow (complex fields)

**Goal:** A flow exercising every "complex field" pattern: a dynamic array (add/remove claimed items), a conditional reveal (injury details shown only when "anyone injured?" is checked), and a cross-field rule (total claimed ≤ coverage from `features.AMOUNT.maxAmount`).

**Files:**
- Create: `flows/insurance/{model.ts,schema.ts,fixtures.ts,steps/policy-step.ts,steps/incident-step.ts,steps/items-step.ts,def.ts}`
- Test: `flows/insurance/schema.spec.ts`
- Modify: `flow-registry.ts` (register insurance)

**Acceptance Criteria:**
- [ ] Schema: policy number + incident date + description required; injury details required ONLY when `injured` is true; each item needs a description + positive amount; total amount > `features.AMOUNT.maxAmount` is invalid.
- [ ] The items step can add and remove rows (mutating the array field's value), and the cross-field "over coverage" error surfaces.
- [ ] `insuranceFlow` is a complete `FlowDef` (policy → incident → items → tos), registered.

**Verify:** `pnpm nx test tommy-signal-forms-flow-forge` → insurance schema spec passes (array add/remove, conditional, cross-field); `pnpm nx build tommy-host` → AOT passes.

**Steps:**

- [ ] **Step 1: Write the failing schema spec `flows/insurance/schema.spec.ts`.**
```ts
import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { insuranceFlow } from './def';
import type { FlowEnvelope } from '../../engine/flow-def';

const env: FlowEnvelope = {
  features: { POLICY_NUMBER: { mandatory: true }, INCIDENT_DATE: { mandatory: true }, AMOUNT: { mandatory: true, maxAmount: 1000 } as never },
  terms: { tos: { title: 'Terms', body: 'b', required: true } },
};
const build = () => insuranceFlow.buildForm(env, TestBed.inject(Injector));

describe('insurance schema', () => {
  it('requires injury details only when injured is true', () => {
    const { form } = build();
    expect(form.incident.injured().value()).toBe(false);
    // not injured → injuryDetails not required
    form.incident.date().value.set('2026-01-01');
    form.incident.description().value.set('Fender bender');
    expect(form.incident().valid()).toBe(true);
    form.incident.injured().value.set(true);
    expect(form.incident().valid()).toBe(false); // now injuryDetails required
    form.incident.injuryDetails().value.set('Sprained wrist');
    expect(form.incident().valid()).toBe(true);
  });

  it('flags total claimed over coverage', () => {
    const { form, model } = build();
    model.update((m) => ({ ...m, items: [{ description: 'TV', amount: 800 }, { description: 'Phone', amount: 400 }] }));
    expect(form.items().valid()).toBe(false); // 1200 > 1000
    model.update((m) => ({ ...m, items: [{ description: 'TV', amount: 800 }] }));
    expect(form.items().valid()).toBe(true);  // 800 <= 1000
  });
});
```
Run `pnpm nx test tommy-signal-forms-flow-forge`; confirm FAIL.

NOTE: verify how to read/set array + nested values against the repo's existing specs and the signal-forms `.d.ts`. The model-level `model.update(...)` approach (mutating the `WritableSignal<Model>`) is the canonical way to change array contents; confirm `form.items().valid()` reflects it. If the `as never` cast on the AMOUNT feature is awkward, type the env's features with a local interface that extends `FeatureMap` with the `maxAmount` field.

- [ ] **Step 2: Implement `flows/insurance/model.ts`.**
```ts
import type { FlowEnvelope } from '../../engine/flow-def';
import { tosAcksFrom, type TosAck } from '../../steps/tos-step';

export interface ClaimItem { description: string; amount: number }

export interface InsuranceModel {
  policy: { policyNumber: string };
  incident: { date: string; description: string; injured: boolean; injuryDetails: string };
  items: ClaimItem[];
  tos: TosAck[];
}

export function emptyModel(env: FlowEnvelope): InsuranceModel {
  return {
    policy: { policyNumber: '' },
    incident: { date: '', description: '', injured: false, injuryDetails: '' },
    items: [{ description: '', amount: 0 }],
    tos: tosAcksFrom(env.terms),
  };
}
```

- [ ] **Step 3: Implement `flows/insurance/schema.ts`.**
```ts
import { apply, applyEach, applyFeatureImportPlaceholder, required, schema, validate } from '@angular/forms/signals';
import { applyFeature } from '../../engine/schema-helpers';
import type { FlowEnvelope } from '../../engine/flow-def';
import type { InsuranceModel } from './model';

export function insuranceSchema(env: FlowEnvelope) {
  const maxAmount = (env.features['AMOUNT'] as { maxAmount?: number } | undefined)?.maxAmount ?? Infinity;
  return schema<InsuranceModel>((p) => {
    applyFeature(p.policy.policyNumber, env.features['POLICY_NUMBER'] ?? { mandatory: true }, { requiredMessage: 'Policy number is required' });
    apply(
      p.incident,
      schema((i) => {
        required(i.date, { message: 'Incident date is required' });
        required(i.description, { message: 'Describe what happened' });
        // Conditional reveal: injury details required only when injured.
        validate(i.injuryDetails, (ctx) => (ctx.valueOf(i.injured) && !ctx.value().trim() ? { kind: 'required', message: 'Describe the injury' } : null));
      }),
    );
    applyEach(p.items, (item) => {
      required(item.description, { message: 'Item description is required' });
      validate(item.amount, (ctx) => (Number(ctx.value()) > 0 ? null : { kind: 'min', message: 'Amount must be greater than 0' }));
    });
    // Cross-field: total claimed must not exceed coverage.
    validate(p.items, (ctx) => {
      const total = ctx.value().reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
      return total > maxAmount ? { kind: 'overCoverage', message: `Total claimed (${total}) exceeds coverage of ${maxAmount}` } : null;
    });
  });
}
```
IMPORTANT: the import line above contains a deliberate bogus symbol `applyFeatureImportPlaceholder` to force you to FIX the imports — remove it; the real imports are `apply, applyEach, required, schema, validate` from `@angular/forms/signals` plus `applyFeature` from the engine. Verify `validate` on an array path (`p.items`) is supported and `ctx.value()` returns the array (confirm against `multi-step-form/flow-schema.ts` cross-field usage and the `.d.ts`). If `validate` on the array node isn't allowed, attach the cross-field check to a sibling/derived node or use `validateTree` — use the real supported API; the contract is "total > coverage → invalid on the items step".

- [ ] **Step 4: Implement the step components.**

`flows/insurance/steps/policy-step.ts` — a single `policyNumber` text field (mirror `contact-step.ts`).

`flows/insurance/steps/incident-step.ts` — `date` (`<input type="date">`), `description` (`<textarea>` or input), `injured` (`<input type="checkbox" [formField]="f.injured">`), and a CONDITIONAL block shown only when injured:
```html
@if (field().injured().value()) {
  <div class="ui-field">
    <label class="ui-label" for="ins-injury">Injury details</label>
    <textarea id="ins-injury" class="ui-input" [formField]="field().injuryDetails"></textarea>
    <tommy-field-error [field]="field().injuryDetails" [show]="showErrors()" />
  </div>
}
```
Each field gets a `tommy-field-error`. `implements StepComponent<InsuranceModel['incident']>`.

`flows/insurance/steps/items-step.ts` — the dynamic array. Iterate the array field, render a description + amount row each with a remove button, plus an "Add item" button and the array-level (cross-field) error:
```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { StepComponent } from '../../../engine/flow-def';
import type { ClaimItem } from '../model';
import { FieldError } from '../../../ui/field-error';

@Component({
  selector: 'tommy-insurance-items-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @for (row of f; track $index; let i = $index) {
        <div class="ui-row">
          <input class="ui-input" placeholder="Item" [formField]="row.description" />
          <input class="ui-input" type="number" placeholder="Amount" [formField]="row.amount" />
          <button type="button" class="ui-btn" (click)="remove(i)" [disabled]="f.length <= 1">Remove</button>
        </div>
        <tommy-field-error [field]="row.description" [show]="showErrors()" />
        <tommy-field-error [field]="row.amount" [show]="showErrors()" />
      }
      <button type="button" class="ui-btn" (click)="add()">+ Add item</button>
      <!-- array-level (over-coverage) error -->
      @if (showErrors() && f().invalid()) {
        @for (err of f().errors(); track $index) {
          <span class="ui-error">{{ err.message }}</span>
        }
      }
    </div>
  `,
})
export class ItemsStep implements StepComponent<ClaimItem[]> {
  readonly field = input.required<FieldTree<ClaimItem[]>>();
  readonly showErrors = input(false);

  add(): void {
    this.field()().value.update((arr) => [...arr, { description: '', amount: 0 }]);
  }
  remove(i: number): void {
    this.field()().value.update((arr) => arr.filter((_, idx) => idx !== i));
  }
}
```
IMPORTANT: `this.field()()` calls the FieldTree node to get its FieldState, then `.value` is the `WritableSignal<ClaimItem[]>` — `.update(...)` mutates the array and the form re-applies `applyEach`. VERIFY this is how array value mutation works in 21.2.x (read the `.d.ts` / the `tos-step.ts` which iterates an array field, and confirm `node().value` is a writable signal on an array node). If array mutation must go through a different API, use the real one; the contract is add/remove rows. Confirm `f().errors()` exposes the array-node's own errors (the over-coverage `kind`) — if cross-field errors live elsewhere, surface them from the right node.

`flows/insurance/steps/incident-step.ts` and `policy-step.ts`: write complete, mirroring the newsletter step components.

- [ ] **Step 5: Implement `flows/insurance/fixtures.ts`** (always 200 on submit — insurance has no signing).
```ts
import type { FlowFixture } from '../../engine/flow-backend';
import type { FeatureDescriptor } from '../../engine/flow-def';

export type InsuranceFeatures = {
  POLICY_NUMBER: FeatureDescriptor;
  INCIDENT_DATE: FeatureDescriptor;
  AMOUNT: FeatureDescriptor & { maxAmount: number };
};

export const insuranceFixture: FlowFixture<InsuranceFeatures> = {
  features: {
    POLICY_NUMBER: { mandatory: true },
    INCIDENT_DATE: { mandatory: true },
    AMOUNT: { mandatory: true, maxAmount: 50000 },
  },
  terms: {
    tos: { title: 'Claim Terms', body: 'You confirm the information provided is accurate.', required: true },
  },
  submit: (payload) => ({ status: 'ok', httpStatus: 200, confirmationId: `CLAIM-${(payload as { items?: unknown[] }).items?.length ?? 0}` }),
};
```

- [ ] **Step 6: Implement `flows/insurance/def.ts`** (mirror bank/newsletter `def.ts`: 4 steps policy → incident → items → tos; `toSubmission` projects policy/incident/items/acceptedTermIds). Write it complete.

- [ ] **Step 7: Register insurance in `flow-registry.ts`** (append `insuranceFlow`/`insuranceFixture` to `FLOWS`/`FIXTURES`, keyed `'insurance'`).

- [ ] **Step 8: Run tests + AOT build.**

Run: `pnpm nx test tommy-signal-forms-flow-forge` → insurance schema spec PASSES (conditional + cross-field); all existing PASS.
Run: `pnpm nx build tommy-host` → AOT compiles the insurance step templates (gallery now shows 3 flows).

- [ ] **Step 9: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/flows/insurance \
        libs/tommy/signal-forms/flow-forge/src/lib/flow-registry.ts
git commit -m "feat(flow-forge): insurance flow (dynamic array + conditional + cross-field)"
```

---

### Task 6: End-to-end MitID integration test + docs

**Goal:** A seam-level integration test proving the bank flow's full 202 → redirect → callback → resume → 200 round-trip, plus README updates (run both apps, Vercel note) and a refreshed lib README listing all three flows.

**Files:**
- Create: `libs/tommy/signal-forms/flow-forge/src/lib/flows/bank/round-trip.spec.ts`
- Modify: `README.md`, `libs/tommy/signal-forms/flow-forge/README.md`

**Acceptance Criteria:**
- [ ] An integration test drives the bank flow through submit → 202 (snapshot saved + redirect captured via the `ExternalRedirect` seam) → simulated approved callback (matching `state` + a `code`) → runner resume → 200 `ok` → `done`. (No real cross-origin navigation; the redirect + provider are simulated via seams.)
- [ ] Root README documents running BOTH apps (`nx serve tommy-host` + `nx serve tommy-mock-idp`) and the Vercel/prod implication (bank signing needs a deployed mock-idp origin or is dev-only).
- [ ] Lib README lists all three flows and notes the MitID round-trip is now wired.
- [ ] `pnpm check` passes across the workspace.

**Verify:** `pnpm check` → all targets pass.

**Steps:**

- [ ] **Step 1: Write the round-trip integration test `flows/bank/round-trip.spec.ts`.**

Mount `FlowRunner` with the real `bankFlow` + a `FLOW_FIXTURES` map containing `bankFixture`, and a fake `ExternalRedirect`. Drive: Start → fill applicant + account-type + tos → Submit → assert a snapshot was saved (`sessionStorage`) and the fake redirect captured a URL with `state` + `return`. Then simulate the provider: parse the redirect URL, build the approved callback params, mount a SECOND `FlowRunner` with a `resume` input `{ model: <saved snapshot model>, signature: { challengeId, code } }`, and assert it reaches `done` with a `BANK-` confirmation id.

```ts
import { TestBed } from '@angular/core/testing';
import { FlowRunner } from '../../engine/flow-runner';
import { FlowBackend, FLOW_FIXTURES } from '../../engine/flow-backend';
import { ExternalRedirect } from '../../engine/external-redirect';
import { FlowStateStore } from '../../engine/flow-state-store';
import { bankFlow } from './def';
import { bankFixture } from './fixtures';

class FakeRedirect { last: string | null = null; origin = 'http://localhost:4200'; to(u: string) { this.last = u; } }

// helper: fill all bank steps with valid data, reach last step, submit. (Use the
// real-timeout wait pattern from flow-runner.spec.ts for the 500ms backend delay.)
```
Write the full test using the established helpers/patterns from `flow-runner.spec.ts` (real-timeout awaits, button-by-text clicking). The two phases (submit→202→snapshot/redirect; resume→200→done) prove the engine round-trip without real navigation. Run it; iterate until green.

NOTE: this is the automated proof. The TRUE cross-origin navigation (browser leaving 4200 → 4300 → back) is verified MANUALLY (Step 3 of the README); there is no e2e runner in this workspace (`e2eTestRunner: none`).

- [ ] **Step 2: Update the lib README** (`libs/tommy/signal-forms/flow-forge/README.md`): change the status note to "all three flows shipped" — newsletter (minimal), insurance (complex fields: dynamic array + conditional + cross-field), bank (MitID signing). Add a short "MitID round-trip" section: submit → 202 → engine persists snapshot + redirects to `mock-idp` (port 4300) → approve → callback → launcher rehydrates → runner re-submits with the code → 200. Mention `apps/tommy/mock-idp`.

- [ ] **Step 3: Update the root README** (`README.md`): in the Commands/Getting-Started area, document running both servers for the bank flow:
```bash
pnpm nx serve tommy-host        # http://localhost:4200
pnpm nx serve tommy-mock-idp    # http://localhost:4300  (MitID provider — needed for the bank flow)
```
Add a one-line note: the bank flow's MitID signing redirects to the `mock-idp` origin; in production it needs a deployed provider origin (set in `engine/mitid.ts` `MOCK_IDP_ORIGIN`) or the bank flow is dev-only. Add a `mock-idp` row under the Repository Layout `apps/` block.

- [ ] **Step 4: Run the full suite.**

Run: `pnpm check`
Expected: `lint`, `test`, `typecheck`, `build` PASS across the workspace (now 5 projects incl. `tommy-mock-idp`).

- [ ] **Step 5: Commit.**

```bash
git add libs/tommy/signal-forms/flow-forge/src/lib/flows/bank/round-trip.spec.ts \
        README.md libs/tommy/signal-forms/flow-forge/README.md
git commit -m "test(flow-forge): bank MitID round-trip integration + docs for both apps"
```

---

## Self-Review

**Spec coverage (Plan 2 scope):**
- Insurance flow — complex fields (dynamic array, conditional reveal, cross-field via `applyFeature`/`AMOUNT`) → Task 5 ✓
- Bank flow — in-context MitID signing via 202 → Task 4 ✓
- Cross-origin `mock-idp` app (separate origin/port, approve/cancel, return-origin guard) → Task 3 ✓
- Real 202 → redirect → callback → rehydrate → re-submit round-trip → Tasks 1 (runner resume) + 2 (launcher resume) + 6 (integration proof) ✓
- `afterNextRender` focus-on-step-change (deferred from Plan 1) → Task 1 ✓
- README run/Vercel notes + lib README → Task 6 ✓
- Engine absorbs both flows with NO contract change (only an additive `resume` input) → confirmed: `FlowDef`/`StepDef`/`StepComponent` unchanged.

**Placeholder scan:** No "TBD/TODO". Two deliberate "fix-me" seeds are intentional teaching aids with explicit instructions to correct them (the `applyFeatureImportPlaceholder` bogus import in Task 5 Step 3, and the `??`/`+` precedence note in Task 4 Step 5) — both name the exact fix. Step components in Tasks 4/5 that "mirror" newsletter are described with their exact field set + the one novel part (radio, conditional, array) shown in full; the trivial text-field steps follow an existing in-repo pattern the implementer has already built.

**Type consistency:** `ResumeData` ({model, signature}) is produced by the launcher (Task 2) and consumed by the runner (Task 1) identically. `Signature` ({challengeId, code}) matches `flow-def.ts`. `MOCK_IDP_ORIGIN` defined in Task 4 Step 1, consumed by the bank fixture (Task 4) and referenced in docs (Task 6). Flow registry keys (`bank`, `insurance`) match fixture map keys. `onSubmit(signature?)` is backward-compatible with the template's no-arg call.

**Risks flagged for the implementer (verify against real API, fix to the real one):** array value mutation via `node().value.update()`; `validate` on an array path for the cross-field rule; `afterNextRender` injection-context requirement; number-input `[formField]` binding (coerce with `Number()` in validators). Each step says "use the real supported API; the contract is X."
