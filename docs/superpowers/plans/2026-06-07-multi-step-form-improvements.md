# Multi-Step Form — UX & Validation Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the `multi-step-form` signal-forms experiment: inline Start/Submit spinners (no interstitials), Back grouped right + Back-to-intro with data preserved, a frozen per-step error banner with clear-on-edit inline errors, and an equal-size panel across all steps.

**Architecture:** The change is confined to one lib, `libs/tommy/signal-forms/multi-step-form`. The container component (`MultiStepFlow`) owns the state machine; we replace the `loading`/`submitting`/`error` interstitial *phases* with boolean signals and replace the single live `showErrors` boolean with a per-step "gate" (`null | [] | string[]`). The gate's banner array is a frozen snapshot taken only on Next/Submit. Inline errors lean on signal-forms' own `FieldState.reset()` (clears `dirty`/`touched` without touching values) + `dirty()` so an edited field's error hides until the next press. Step presentational components are unchanged.

**Tech Stack:** Angular 21 (zoneless host), `@angular/forms/signals` (experimental), Vitest + jsdom, Nx, plain-CSS `.ui-*` design layer.

---

## File structure

| File | Responsibility | Change |
| --- | --- | --- |
| `src/lib/ui/field-error.ts` | Inline single-field error | Add `!dirty()` to the reveal gate |
| `src/lib/ui/field-error.spec.ts` | FieldError tests | Add a dirty-field case |
| `src/lib/ui/ui.css` | `.ui-*` design layer | Add `.ui-spinner`, `.ui-foot`; make `.ui-card` equal-height; right-align `.ui-row` |
| `src/lib/multi-step-flow.ts` | Container state machine | Phases→booleans, per-step gate, `validateStep()`, Back-to-intro, resume, submit spinner |
| `src/lib/multi-step-flow.html` | Container template | Intro/Submit spinners, right-grouped nav, frozen banner binding |
| `src/lib/multi-step-flow.spec.ts` | Container tests | Rewrite live-banner test; add spinner / back-to-intro / clear-on-edit tests |

Step components (`profile-step.ts`, `account-step.ts`, `tos-step.ts`), the model, schema, and service are **not** touched — steps already forward their `showErrors` input straight to `FieldError`.

---

### Task 1: `FieldError` — hide a field's error once it is edited

**Goal:** An inline field error shows only while the field is invalid AND has not been edited since the last validation reset (`!dirty()`), so it clears the moment the user starts typing.

**Files:**
- Modify: `libs/tommy/signal-forms/multi-step-form/src/lib/ui/field-error.ts`
- Test: `libs/tommy/signal-forms/multi-step-form/src/lib/ui/field-error.spec.ts`

**Acceptance Criteria:**
- [ ] With `show()` true and the field pristine + invalid, the inline error renders.
- [ ] With `show()` true and the field `dirty()` + invalid, nothing renders.
- [ ] Existing FieldError tests still pass.

**Verify:** `pnpm nx test tommy-signal-forms-multi-step-form -- field-error` → PASS

**Steps:**

- [ ] **Step 1: Add the failing test** to `field-error.spec.ts` (append inside the `describe('FieldError', ...)` block, after the last `it`):

```ts
  it('hides the error once the field is dirty, even while invalid and show is true', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    // Pristine + invalid → visible.
    expect(el.querySelector('span.ui-error')).not.toBeNull();
    // User starts editing → dirty → error hides and stays hidden.
    fixture.componentInstance.form.name().markAsDirty();
    fixture.detectChanges();
    expect(el.querySelector('.ui-error')).toBeNull();
  });
```

- [ ] **Step 2: Run the test, watch it fail**

Run: `pnpm nx test tommy-signal-forms-multi-step-form -- field-error`
Expected: FAIL — the error span is still present after `markAsDirty()` (current gate ignores `dirty`).

- [ ] **Step 3: Update the component gate.** In `field-error.ts`, change the template condition and refresh the doc comment so the contract is documented:

Replace the class doc comment + template with:

```ts
/**
 * Renders a single field's first validation error, but only after `show` becomes
 * true (the step has been validated, i.e. Next/Submit was pressed) AND the field
 * has not been edited since (`!dirty()`). The container resets the step's
 * `dirty`/`touched` on each Next press, so a still-invalid field re-reveals its
 * error then, while a field the user has started fixing stays quiet until the
 * next press. Generic so it accepts any field node type — `FieldTree<T>` is
 * invariant in T. Emits a `<span>` so it is valid inside both `<div>` and
 * `<span>` field rows.
 */
@Component({
  selector: 'tommy-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let node = field();
    @let state = node();
    @if (show() && state.invalid() && !state.dirty()) {
      <span class="ui-error">{{ state.errors()[0]?.message }}</span>
    }
  `,
})
```

(Leave the class body — `field` and `show` inputs — unchanged.)

- [ ] **Step 4: Run the tests, watch them pass**

Run: `pnpm nx test tommy-signal-forms-multi-step-form -- field-error`
Expected: PASS (4 tests). The pre-existing "hides the error again once the field becomes valid" test still passes — setting the value via `.set()` makes the field valid, so the gate is false regardless of `dirty`.

- [ ] **Step 5: Commit**

```bash
git add libs/tommy/signal-forms/multi-step-form/src/lib/ui/field-error.ts \
        libs/tommy/signal-forms/multi-step-form/src/lib/ui/field-error.spec.ts
git commit -m "feat(multi-step-form): hide inline field error once the field is edited"
```

---

### Task 2: Shared spinner + equal-size panel (CSS)

**Goal:** Add a reusable `.ui-spinner`, give `.ui-card` an equal `min-height` across steps, and right-group the nav row pinned to the bottom of the card.

**Files:**
- Modify: `libs/tommy/signal-forms/multi-step-form/src/lib/ui/ui.css`

**Acceptance Criteria:**
- [ ] `.ui-spinner` exists: a small spinning ring, `display: inline-block`, sized to the button text.
- [ ] `.ui-card` has a `min-height` so every step (and intro/done) occupies the same height.
- [ ] `.ui-row` right-aligns its buttons (`justify-content: flex-end`).
- [ ] `.ui-foot` pins an element to the bottom of the flex-column card (`margin-top: auto`).
- [ ] `pnpm nx build tommy-host` succeeds (AOT — catches template/style issues).

**Verify:** `pnpm nx build tommy-host` → build succeeds; then `pnpm nx serve tommy-host` and confirm each step is the same height with the nav at the bottom-right.

**Steps:**

- [ ] **Step 1: Right-align the nav row.** In `ui.css`, change `.ui-row`'s `justify-content` from `space-between` to `flex-end`:

```css
.ui-row {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  gap: 0.5rem;
}
```

- [ ] **Step 2: Give the card an equal height.** Add a `min-height` to `.ui-card` (the section already has `.ui-stack` → `display: flex; flex-direction: column`, so the floor + flex column are all we need):

```css
.ui-card {
  max-width: 32rem;
  min-height: 30rem;
  border: 1px solid #d0d7de;
  border-radius: 0.75rem;
  padding: 1.5rem;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
```

- [ ] **Step 3: Add the bottom-pin utility + spinner.** Append to `ui.css`:

```css
/* Pin an element to the bottom of the flex-column card (nav row, intro/done CTA). */
.ui-foot {
  margin-top: auto;
}

/* Small inline loading ring; rendered aria-hidden next to button text. */
.ui-spinner {
  display: inline-block;
  width: 0.9em;
  height: 0.9em;
  margin-right: 0.4em;
  vertical-align: -0.1em;
  border: 2px solid currentColor;
  border-right-color: transparent;
  border-radius: 50%;
  animation: ui-spin 0.6s linear infinite;
}
@keyframes ui-spin {
  to {
    transform: rotate(360deg);
  }
}
```

- [ ] **Step 4: Build (AOT) to confirm the styles compile into the host**

Run: `pnpm nx build tommy-host`
Expected: build succeeds.

- [ ] **Step 5: Visually tune `min-height`.** Run `pnpm nx serve tommy-host`, open the `multi-step-form` experiment, and click through intro → profile → account → terms. The tallest step is Terms. Adjust `.ui-card`'s `min-height` so the Terms step (without a banner) just fits and every other step matches it (no shrinking). `30rem` is the starting point — nudge up if Terms overflows past the others, down if there's excess empty space below the nav on the tall step.

- [ ] **Step 6: Commit**

```bash
git add libs/tommy/signal-forms/multi-step-form/src/lib/ui/ui.css
git commit -m "feat(multi-step-form): shared spinner + equal-height panel with right-grouped nav"
```

---

### Task 3: `MultiStepFlow` container — spinners, gate, frozen banner, Back-to-intro

**Goal:** Rework the container so Start/Submit show inline spinners (no interstitials), Back is grouped right and returns to intro from the first step (form preserved, resume on Start), and validation uses a per-step gate: a frozen banner snapshot + clear-on-edit inline errors via `FieldState.reset()`.

**Files:**
- Modify: `libs/tommy/signal-forms/multi-step-form/src/lib/multi-step-flow.ts`
- Modify: `libs/tommy/signal-forms/multi-step-form/src/lib/multi-step-flow.html`
- Test: `libs/tommy/signal-forms/multi-step-form/src/lib/multi-step-flow.spec.ts`

**Acceptance Criteria:**
- [ ] Clicking Start keeps the intro visible with the Start button disabled + a spinner; the page changes to Profile only once options resolve.
- [ ] On load failure, the intro shows `loadError` inline and Start re-enables (retry); there is no separate loading/error screen.
- [ ] Back is grouped with Next/Submit on the right; Back on Profile returns to the intro page; pressing Start again resumes Profile with data intact and no re-fetch.
- [ ] The banner is a frozen per-step snapshot: editing fields never changes it; it updates/clears only on a Next/Submit press; a clean press clears it for that step.
- [ ] An inline field error clears when the user edits the field and does not reappear (even for a new invalid value) until the next Next/Submit press.
- [ ] Submit keeps the form visible with the Submit button disabled + a spinner; success → done screen; server "taken" → account step with the username error inline + in the banner.
- [ ] All container tests pass.

**Verify:** `pnpm nx test tommy-signal-forms-multi-step-form` → PASS, and `pnpm nx build tommy-host` → succeeds (AOT).

**Steps:**

- [ ] **Step 1: Replace the component class.** Overwrite `multi-step-flow.ts` with:

```ts
import {
  ChangeDetectionStrategy,
  Component,
  Injector,
  computed,
  inject,
  signal,
} from '@angular/core';
import { submit } from '@angular/forms/signals';
import { FlowService } from './model/flow.service';
import { createFlowForm, type FlowForm } from './model/create-flow-form';
import type { FlowOptions, FlowSubmission } from './model/flow-options';
import type { FlowModel } from './model/flow-model';
import { ProfileStep } from './steps/profile-step';
import { AccountStep } from './steps/account-step';
import { TosStep } from './steps/tos-step';
import { StepIndicator } from './ui/step-indicator';
import { ErrorBanner } from './ui/error-banner';

type Phase = 'intro' | 'form' | 'done';
type StepKey = 'profile' | 'account' | 'tos';
const STEPS: readonly StepKey[] = ['profile', 'account', 'tos'];

function toSubmission(model: FlowModel): FlowSubmission {
  return {
    profile: { ...model.profile },
    account: {
      username: model.account.username,
      password: model.account.password,
    },
    acceptedTosIds: model.tos.filter((t) => t.accepted).map((t) => t.id),
  };
}

@Component({
  selector: 'tommy-multi-step-flow',
  imports: [ProfileStep, AccountStep, TosStep, StepIndicator, ErrorBanner],
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
  protected readonly starting = signal(false);
  protected readonly submitting = signal(false);

  /**
   * Per-step validation gate.
   *  - `null`  → step not validated yet (no Next/Submit pressed here)
   *  - `[]`    → validated and clean (banner cleared for this step)
   *  - `[...]` → validated and invalid; a *frozen* snapshot of banner messages
   * The banner reads this snapshot directly, so editing fields never changes it —
   * only a Next/Submit press re-runs validateStep() and rewrites the entry.
   */
  protected readonly gate = signal<Record<StepKey, readonly string[] | null>>({
    profile: null,
    account: null,
    tos: null,
  });

  protected readonly stepLabels: readonly string[] = [
    'Profile',
    'Account',
    'Terms',
  ];
  protected readonly currentStep = computed(() => STEPS[this.stepIndex()]);
  protected readonly isFirst = computed(() => this.stepIndex() === 0);
  protected readonly isLast = computed(
    () => this.stepIndex() === STEPS.length - 1,
  );

  /** `true` once Next/Submit has been pressed on the current step. Drives the
   *  inline field errors (which then self-hide once a field is edited). */
  protected readonly attempted = computed(
    () => this.gate()[this.currentStep()] !== null,
  );

  /** The frozen banner snapshot for the current step (empty = no banner). */
  protected readonly bannerMessages = computed<readonly string[]>(
    () => this.gate()[this.currentStep()] ?? [],
  );

  /** The active step's FieldState (concrete per step, so we read `valid`/
   *  `errorSummary`/`reset` off a known node). */
  private readonly currentStepState = computed(() => {
    const ff = this.flowForm();
    if (!ff) return null;
    switch (this.currentStep()) {
      case 'profile':
        return ff.form.profile();
      case 'account':
        return ff.form.account();
      case 'tos':
        return ff.form.tos();
    }
  });

  async start(): Promise<void> {
    // Resume a form that was already built (e.g. after Back → intro): keep the
    // user's data, no re-fetch, no spinner.
    if (this.flowForm()) {
      this.phase.set('form');
      return;
    }
    this.starting.set(true);
    this.loadError.set(null);
    try {
      const opts = await this.flow.loadOptions();
      this.options.set(opts);
      this.flowForm.set(createFlowForm(opts, this.injector));
      this.stepIndex.set(0);
      this.phase.set('form');
    } catch {
      this.loadError.set('Could not start the sign-up flow. Please retry.');
    } finally {
      this.starting.set(false);
    }
  }

  next(): void {
    if (!this.validateStep()) return;
    if (!this.isLast()) this.stepIndex.update((i) => i + 1);
  }

  back(): void {
    if (this.isFirst()) {
      // Back from the first step returns to the intro page (form preserved).
      this.phase.set('intro');
      return;
    }
    this.stepIndex.update((i) => i - 1);
  }

  async onSubmit(): Promise<void> {
    const ff = this.flowForm();
    if (!ff) return;
    if (!this.validateStep()) return;
    this.submitError.set(null);
    this.confirmationId.set(null);
    this.submitting.set(true);

    try {
      await submit(ff.form, {
        action: async (field) => {
          const result = await this.flow.submitFlow(
            toSubmission(field().value()),
          );
          if (result.ok) {
            this.confirmationId.set(result.confirmationId);
            return null;
          }
          return result.fieldErrors.map((e) => ({
            kind: 'server',
            message: e.message,
            fieldTree: field.account.username,
          }));
        },
      });
    } catch {
      this.submitError.set('An unexpected error occurred. Please try again.');
    } finally {
      this.submitting.set(false);
    }

    if (this.confirmationId()) {
      this.phase.set('done');
      return;
    }
    // Server rejected (or threw) — return to the account step with the error
    // visible. Reset the subtree so the (untouched) username re-reveals its
    // inline server error, and freeze the account banner from the live errors.
    const accountState = ff.form.account();
    accountState.reset();
    this.setGate('account', this.snapshotMessages(accountState.errorSummary()));
    this.stepIndex.set(STEPS.indexOf('account'));
  }

  reset(): void {
    this.phase.set('intro');
    this.options.set(null);
    this.flowForm.set(null);
    this.stepIndex.set(0);
    this.confirmationId.set(null);
    this.loadError.set(null);
    this.submitError.set(null);
    this.starting.set(false);
    this.submitting.set(false);
    this.gate.set({ profile: null, account: null, tos: null });
  }

  /**
   * Validate the active step. On success, clears that step's banner and returns
   * `true`. On failure, freezes the banner to the current error snapshot, resets
   * the subtree's touched/dirty (so every still-invalid field re-reveals its
   * inline error and edited-then-fixed fields stop showing), and returns `false`.
   */
  private validateStep(): boolean {
    const state = this.currentStepState();
    if (!state) return false;
    const step = this.currentStep();
    if (state.valid()) {
      this.setGate(step, []);
      return true;
    }
    this.setGate(step, this.snapshotMessages(state.errorSummary()));
    state.reset();
    return false;
  }

  /** One message per invalid field (dedupe by field, first message), mirroring
   *  the inline messages. */
  private snapshotMessages(
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

  private setGate(step: StepKey, value: readonly string[]): void {
    this.gate.update((g) => ({ ...g, [step]: value }));
  }
}
```

- [ ] **Step 2: Replace the template.** Overwrite `multi-step-flow.html` with:

```html
<section class="ui-card ui-stack">
  @switch (phase()) {

  @case ('intro') {
  <h2 class="ui-title">Create your account</h2>
  <p class="ui-muted">
    A guided, multi-step sign-up powered by Angular signal forms.
  </p>
  @if (loadError()) {
  <p class="ui-error">{{ loadError() }}</p>
  }
  <button
    type="button"
    class="ui-btn ui-btn-primary ui-foot"
    [disabled]="starting()"
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
  <button type="button" class="ui-btn ui-foot" (click)="reset()">
    Start over
  </button>
  }

  @case ('form') { @if (flowForm(); as ff) {
  <tommy-step-indicator [labels]="stepLabels" [activeIndex]="stepIndex()" />
  <tommy-error-banner [messages]="bannerMessages()" />

  @switch (currentStep()) { @case ('profile') {
  <tommy-profile-step [field]="ff.form.profile" [showErrors]="attempted()" />
  } @case ('account') {
  <tommy-account-step [field]="ff.form.account" [showErrors]="attempted()" />
  <!-- Unexpected/thrown submit errors only; server field errors surface via the banner + inline. -->
  @if (submitError()) {
  <p class="ui-error">{{ submitError() }}</p>
  } } @case ('tos') {
  <tommy-tos-step
    [field]="ff.form.tos"
    [items]="options()?.tos ?? []"
    [showErrors]="attempted()"
  />
  } }

  <div class="ui-row ui-foot">
    <button type="button" class="ui-btn" (click)="back()">Back</button>
    @if (isLast()) {
    <button
      type="button"
      class="ui-btn ui-btn-primary"
      [disabled]="submitting()"
      (click)="onSubmit()"
    >
      @if (submitting()) {
      <span class="ui-spinner" aria-hidden="true"></span> Submitting…
      } @else { Submit }
    </button>
    } @else {
    <button type="button" class="ui-btn ui-btn-primary" (click)="next()">
      Next
    </button>
    }
  </div>
  } } }
</section>
```

- [ ] **Step 3: Update the spec — imports + rewrite the live-banner test.**

In `multi-step-flow.spec.ts`, add `vi` to the top imports (used by the new resume test):

```ts
import { vi } from 'vitest';
```

Then **replace** the existing test block titled `'clears the banner live once the step becomes valid, then advances'` (the whole `it(...)`) with this frozen-banner version:

```ts
  it('keeps the banner frozen while editing; it clears and advances only on Next', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next'); // reveal errors on the (empty) profile step
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')).not.toBeNull();

    // Filling the fields does NOT move the banner — it is frozen until Next.
    setInput(fixture, '#ms-firstName', 'Tommy');
    setInput(fixture, '#ms-lastName', 'C');
    setInput(fixture, '#ms-email', 'tommy@example.com');
    expect(el.querySelector('[role=alert]')).not.toBeNull();

    // Pressing Next now: the step is valid → banner clears AND we advance.
    clickButton(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Username',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role=alert]'),
    ).toBeNull();
  });
```

- [ ] **Step 4: Add the new behavior tests.** Append these inside the `describe('MultiStepFlow', ...)` block:

```ts
  it('clears a field inline error on edit and does not re-show it until the next Next', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next'); // reveal inline errors on the empty profile
    const el = fixture.nativeElement as HTMLElement;
    const firstNameError = () =>
      el
        .querySelector('#ms-firstName')!
        .closest('.ui-field')!
        .querySelector('.ui-error');

    expect(firstNameError()).not.toBeNull();

    // Start typing → that field's inline error clears.
    setInput(fixture, '#ms-firstName', 'T');
    expect(firstNameError()).toBeNull();

    // Going invalid again (cleared) does NOT re-show it — only a Next press does.
    setInput(fixture, '#ms-firstName', '');
    expect(firstNameError()).toBeNull();

    clickButton(fixture, 'Next');
    expect(firstNameError()).not.toBeNull();
  });

  it('disables Start and shows a spinner while loading, then advances', async () => {
    let resolveOpts!: (o: FlowOptions) => void;
    stub.loadOptions = () =>
      new Promise<FlowOptions>((r) => {
        resolveOpts = r;
      });
    const fixture = TestBed.createComponent(MultiStepFlow);
    fixture.detectChanges();
    clickButton(fixture, 'Start');

    const el = fixture.nativeElement as HTMLElement;
    const startBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Starting'),
    );
    expect(startBtn?.disabled).toBe(true);
    expect(el.querySelector('.ui-spinner')).not.toBeNull();
    expect(el.textContent).toContain('Create your account'); // still on intro

    resolveOpts(OPTS);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('First name');
  });

  it('Back on the profile step returns to intro and resumes with data preserved', async () => {
    const fixture = await startFlow();
    setInput(fixture, '#ms-firstName', 'Tommy');

    clickButton(fixture, 'Back');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Create your account'); // intro

    const spy = vi.spyOn(stub, 'loadOptions');
    clickButton(fixture, 'Start');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('First name'); // resumed on profile
    expect(
      (el.querySelector('#ms-firstName') as HTMLInputElement).value,
    ).toBe('Tommy'); // data preserved
    expect(spy).not.toHaveBeenCalled(); // no re-fetch
  });

  it('disables Submit and shows a spinner while submitting', async () => {
    let resolveSubmit!: (r: SubmitResult) => void;
    stub.submitFlow = () =>
      new Promise<SubmitResult>((r) => {
        resolveSubmit = r;
      });
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'tommy123');

    clickButton(fixture, 'Submit');
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Submitting'),
    );
    expect(submitBtn?.disabled).toBe(true);
    expect(el.querySelector('.ui-spinner')).not.toBeNull();

    resolveSubmit({ ok: true, confirmationId: 'SIGNUP-tommy123' });
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('All set');
  });
```

- [ ] **Step 5: Run the full container suite, watch it pass**

Run: `pnpm nx test tommy-signal-forms-multi-step-form`
Expected: PASS. All pre-existing tests still pass (happy path, server "taken", unexpected-submit-error, no-errors-on-blur, reveal-on-invalid-Next, Next-stays-enabled) plus the rewritten frozen-banner test and the four new tests.

If `clears a field inline error on edit...` fails at the first `setInput` assertion, confirm the `input` event marks the field `dirty` (it should via the `FormField` directive); the per-field error must disappear after typing.

- [ ] **Step 6: AOT build (catches NG8022 / template errors the JIT specs miss)**

Run: `pnpm nx build tommy-host`
Expected: build succeeds. (No native validation attributes were added to `[formField]` elements, so NG8022 should not trigger.)

- [ ] **Step 7: Commit**

```bash
git add libs/tommy/signal-forms/multi-step-form/src/lib/multi-step-flow.ts \
        libs/tommy/signal-forms/multi-step-form/src/lib/multi-step-flow.html \
        libs/tommy/signal-forms/multi-step-form/src/lib/multi-step-flow.spec.ts
git commit -m "feat(multi-step-form): inline spinners, frozen per-step banner, Back-to-intro"
```

---

## Final verification

- [ ] `pnpm nx test tommy-signal-forms-multi-step-form` → all PASS
- [ ] `pnpm nx build tommy-host` → succeeds (AOT over the lazy-loaded `MultiStepFlow`)
- [ ] Manual run (`pnpm nx serve tommy-host`, open `multi-step-form`): Start spinner → Profile; equal panel height across steps; Back grouped right; Back from Profile → intro → Start resumes with data; Next reveals frozen banner + inline errors; typing clears that field's inline error (banner unchanged); fixing all + Next clears banner and advances; Submit spinner; `taken` username → account step with inline + banner error.

## README touch-up (optional, same commit as Task 3 or a follow-up)

The lib `README.md` "Flow" diagram still shows `intro ─(Start)→ loading ─→ …`. If updating docs, revise it to reflect the inline-spinner Start (no `loading` phase) and Back-to-intro. Not required for the feature to work; skip if out of scope.

## Notes / Non-goals

- No changes to `FlowService`, `flow-options.ts`, `flow-model.ts`, `flow-schema.ts`, the step components, or `step-indicator.ts`.
- `field-error.ts`'s `show` input keeps its name; its meaning is documented as "the step has been validated".
- The `min-height` value is tuned visually in Task 2; `30rem` is the starting point.
