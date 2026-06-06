# Multi-step form: deferred errors + summary banner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make validation errors in the sign-up flow appear only after the user presses Next/Submit (never on blur), keep Next/Submit always clickable, and add a yellow error-summary banner below the step indicator.

**Architecture:** Approach B — two new presentational components. `FieldError<T>` (generic, type-safe under `strictTemplates`) renders a single field's first error when `show && invalid`, centralizing the "show only after Next" rule that today is copy-pasted across all step components. `ErrorBanner` renders a plain `string[]` as a `role="alert"` warning list. The container computes the banner's messages from `FieldState.errorSummary()` (a signal aggregating a node's errors + all descendants') and stops disabling the nav buttons.

**Tech Stack:** Angular 21.2.x, `@angular/forms/signals` (experimental signal forms), Nx, Vitest (`nx test`), plain `.ui-*` CSS design layer.

**Spec:** `docs/superpowers/specs/2026-06-06-multi-step-form-deferred-errors-and-banner-design.md`

**Conventions to follow:**
- Run tasks via Nx: `pnpm nx test tommy-multi-step-form`, `pnpm nx lint tommy-multi-step-form`, `pnpm nx build tommy-multi-step-form`.
- AOT `nx build` is the only check that catches `[formField]` misuse (NG8022) and strict-template type errors — run it before considering the work done.
- Components reference only `.ui-*` classes; new styles go in `src/lib/ui.css`.
- All components are standalone, `ChangeDetectionStrategy.OnPush`, signal `input()`s.

---

### Task 1: ErrorBanner component + banner styles

**Goal:** A presentational `tommy-error-banner` that renders a `role="alert"` yellow warning with a bulleted list of messages, and nothing at all when the list is empty.

**Files:**
- Create: `libs/tommy/multi-step-form/src/lib/error-banner.ts`
- Create: `libs/tommy/multi-step-form/src/lib/error-banner.spec.ts`
- Modify: `libs/tommy/multi-step-form/src/lib/ui.css` (append banner classes)

**Acceptance Criteria:**
- [ ] Renders nothing (no `[role=alert]` element) when `messages` is empty.
- [ ] When `messages` has entries, renders a `[role=alert]` container, the title "One or more fields have errors:", and one `<li>` per message.
- [ ] `.ui-banner-warning` / `.ui-banner-title` / `.ui-banner-list` exist in `ui.css`.

**Verify:** `pnpm nx test tommy-multi-step-form` → ErrorBanner specs pass.

**Steps:**

- [ ] **Step 1: Write the failing test** — `libs/tommy/multi-step-form/src/lib/error-banner.spec.ts`

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorBanner } from './error-banner';

@Component({
  imports: [ErrorBanner],
  template: `<tommy-error-banner [messages]="messages()" />`,
})
class Host {
  readonly messages = signal<readonly string[]>([]);
}

describe('ErrorBanner', () => {
  it('renders nothing when there are no messages', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('renders an alert with a list item per message', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.messages.set(['First name is required', 'Email is required']);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const alert = el.querySelector('[role=alert]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('One or more fields have errors');
    const items = el.querySelectorAll('.ui-banner-list li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('First name is required');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-multi-step-form`
Expected: FAIL — cannot resolve `./error-banner` (module does not exist yet).

- [ ] **Step 3: Write minimal implementation** — `libs/tommy/multi-step-form/src/lib/error-banner.ts`

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Presentational summary of a step's validation errors. Renders nothing when the
 * list is empty; `role="alert"` so assistive tech announces it (it appears on a
 * deliberate Next/Submit press, not on every keystroke).
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
  readonly messages = input.required<readonly string[]>();
}
```

- [ ] **Step 4: Append banner styles** — end of `libs/tommy/multi-step-form/src/lib/ui.css`

```css
.ui-banner-warning {
  border: 1px solid #d4a72c;
  background: #fff8c5;
  color: #4d2d00;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}
.ui-banner-title { margin: 0 0 0.25rem; font-weight: 600; font-size: 0.875rem; }
.ui-banner-list { margin: 0; padding-left: 1.25rem; font-size: 0.875rem; line-height: 1.5; }
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm nx test tommy-multi-step-form`
Expected: PASS — both ErrorBanner specs green.

- [ ] **Step 6: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/error-banner.ts \
        libs/tommy/multi-step-form/src/lib/error-banner.spec.ts \
        libs/tommy/multi-step-form/src/lib/ui.css
git commit -m "feat(multi-step-form): error-summary banner component"
```

---

### Task 2: FieldError generic component

**Goal:** A generic `tommy-field-error` that, given a field node and a `show` flag, renders the field's first error message only when `show && field is invalid` — centralizing the "reveal errors only after Next" rule.

**Files:**
- Create: `libs/tommy/multi-step-form/src/lib/field-error.ts`
- Create: `libs/tommy/multi-step-form/src/lib/field-error.spec.ts`

**Acceptance Criteria:**
- [ ] With `show=false`, renders nothing even when the field is invalid.
- [ ] With `show=true` and an invalid field, renders `<span class="ui-error">` containing the field's first error message.
- [ ] With `show=true` and a valid field, renders nothing.
- [ ] Emits a `<span>` (not `<p>`) so it is valid HTML inside the TOS step's `<span class="ui-field">` wrapper.

**Verify:** `pnpm nx test tommy-multi-step-form` → FieldError specs pass.

**Steps:**

- [ ] **Step 1: Write the failing test** — `libs/tommy/multi-step-form/src/lib/field-error.spec.ts`

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, required, schema, type FieldTree } from '@angular/forms/signals';
import { FieldError } from './field-error';

interface NameModel {
  name: string;
}

const nameSchema = schema<NameModel>((p) => {
  required(p.name, { message: 'Name is required' });
});

@Component({
  imports: [FieldError],
  template: `<tommy-field-error [field]="form.name" [show]="show()" />`,
})
class Host {
  readonly show = signal(false);
  private readonly model = signal<NameModel>({ name: '' });
  readonly form: FieldTree<NameModel> = form(this.model, nameSchema);
}

describe('FieldError', () => {
  it('shows nothing while show is false, even when invalid', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ui-error')).toBeNull();
  });

  it('shows the first error message once show is true and the field is invalid', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const error = el.querySelector('span.ui-error');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('Name is required');
  });

  it('hides the error again once the field becomes valid', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    fixture.componentInstance.form.name().value.set('Tommy');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.ui-error')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-multi-step-form`
Expected: FAIL — cannot resolve `./field-error`.

- [ ] **Step 3: Write minimal implementation** — `libs/tommy/multi-step-form/src/lib/field-error.ts`

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

/**
 * Renders a single field's first validation error, but only after `show` becomes
 * true (i.e. after the user pressed Next/Submit). Generic so it accepts any field
 * node type — `FieldTree<T>` is invariant in T (its value is a WritableSignal<T>),
 * so a non-generic `FieldTree<unknown>` input would reject `FieldTree<string>`.
 * Emits a `<span>` so it is valid HTML inside both `<div>` and `<span>` field rows.
 */
@Component({
  selector: 'tommy-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let node = field();
    @let state = node();
    @if (show() && state.invalid()) {
      <span class="ui-error">{{ state.errors()[0]?.message }}</span>
    }
  `,
})
export class FieldError<T> {
  readonly field = input.required<FieldTree<T>>();
  readonly show = input.required<boolean>();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test tommy-multi-step-form`
Expected: PASS — all three FieldError specs green.

- [ ] **Step 5: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/field-error.ts \
        libs/tommy/multi-step-form/src/lib/field-error.spec.ts
git commit -m "feat(multi-step-form): generic field-error component"
```

---

### Task 3: Switch step components to FieldError and drop the touched() trigger

**Goal:** Replace the seven inline `(showErrors() || x.touched()) && x.invalid()` blocks in the three step components with `<tommy-field-error>`, removing the `touched()` term so errors no longer appear on blur.

**Files:**
- Modify: `libs/tommy/multi-step-form/src/lib/steps/profile-step.ts`
- Modify: `libs/tommy/multi-step-form/src/lib/steps/account-step.ts`
- Modify: `libs/tommy/multi-step-form/src/lib/steps/tos-step.ts`
- Modify: `libs/tommy/multi-step-form/src/lib/steps/steps.spec.ts`

**Acceptance Criteria:**
- [ ] No step component references `.touched()` any more.
- [ ] Each field renders its error via `<tommy-field-error [field]="…" [show]="showErrors()" />`.
- [ ] With `showErrors=false`, no `.ui-error` appears even when fields are invalid; with `showErrors=true`, the relevant `.ui-error` messages appear.
- [ ] Existing smoke test still passes (labels + checkbox count).

**Verify:** `pnpm nx test tommy-multi-step-form` → step specs pass.

**Steps:**

- [ ] **Step 1: Update the smoke spec to assert the new gating** — `libs/tommy/multi-step-form/src/lib/steps/steps.spec.ts`

Replace the whole file with:

```ts
import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, type FieldTree } from '@angular/forms/signals';
import type { FlowOptions } from '../flow-options';
import { emptyFlowModel, type FlowModel } from '../flow-model';
import { flowSchema } from '../flow-schema';
import { ProfileStep } from './profile-step';
import { AccountStep } from './account-step';
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
  imports: [ProfileStep, AccountStep, TosStep],
  template: `
    <tommy-profile-step [field]="form.profile" [showErrors]="show()" />
    <tommy-account-step [field]="form.account" [showErrors]="show()" />
    <tommy-tos-step [field]="form.tos" [items]="opts.tos" [showErrors]="show()" />
  `,
})
class Host {
  readonly opts = OPTS;
  readonly show = signal(false);
  private readonly model = signal<FlowModel>(emptyFlowModel(OPTS));
  readonly form: FieldTree<FlowModel> = form(this.model, flowSchema(OPTS));
}

describe('step components (smoke)', () => {
  it('render against a real form slice', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const text = el.textContent ?? '';
    expect(text).toContain('First name');
    expect(text).toContain('Username');
    expect(text).toContain('Terms');
    expect(text).toContain('News');
    expect(el.querySelectorAll('input[type=checkbox]').length).toBe(2);
  });

  it('hides field errors until showErrors is true', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.ui-error').length).toBe(0);

    fixture.componentInstance.show.set(true);
    fixture.detectChanges();
    const text = el.textContent ?? '';
    expect(el.querySelectorAll('.ui-error').length).toBeGreaterThan(0);
    expect(text).toContain('First name is required');
    expect(text).toContain('Username is required');
    expect(text).toContain('You must accept this to continue');
  });
});
```

- [ ] **Step 2: Run the spec to verify the new test fails**

Run: `pnpm nx test tommy-multi-step-form`
Expected: FAIL — `hides field errors until showErrors is true` fails because today errors also key off `touched()` and there is no `show` input wired the new way / inputs unchanged. (The smoke test itself still passes.)

- [ ] **Step 3: Rewrite `profile-step.ts`** — `libs/tommy/multi-step-form/src/lib/steps/profile-step.ts`

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { ProfileGroup } from '../flow-model';
import { FieldError } from '../field-error';

@Component({
  selector: 'tommy-profile-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="ms-firstName">First name</label>
        <input id="ms-firstName" class="ui-input" [formField]="f.firstName" autocomplete="given-name" />
        <tommy-field-error [field]="f.firstName" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-lastName">Last name</label>
        <input id="ms-lastName" class="ui-input" [formField]="f.lastName" autocomplete="family-name" />
        <tommy-field-error [field]="f.lastName" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-email">Email</label>
        <input id="ms-email" type="email" class="ui-input" [formField]="f.email" autocomplete="email" />
        <tommy-field-error [field]="f.email" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class ProfileStep {
  readonly field = input.required<FieldTree<ProfileGroup>>();
  readonly showErrors = input(false);
}
```

- [ ] **Step 4: Rewrite `account-step.ts`** — `libs/tommy/multi-step-form/src/lib/steps/account-step.ts`

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { AccountGroup } from '../flow-model';
import { FieldError } from '../field-error';

@Component({
  selector: 'tommy-account-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      <div class="ui-field">
        <label class="ui-label" for="ms-username">Username</label>
        <input id="ms-username" class="ui-input" [formField]="f.username" autocomplete="username" />
        <tommy-field-error [field]="f.username" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-password">Password</label>
        <input id="ms-password" type="password" class="ui-input" [formField]="f.password" autocomplete="new-password" />
        <tommy-field-error [field]="f.password" [show]="showErrors()" />
      </div>

      <div class="ui-field">
        <label class="ui-label" for="ms-confirm">Confirm password</label>
        <input id="ms-confirm" type="password" class="ui-input" [formField]="f.confirmPassword" autocomplete="new-password" />
        <tommy-field-error [field]="f.confirmPassword" [show]="showErrors()" />
      </div>
    </div>
  `,
})
export class AccountStep {
  readonly field = input.required<FieldTree<AccountGroup>>();
  readonly showErrors = input(false);
}
```

- [ ] **Step 5: Rewrite `tos-step.ts`** — `libs/tommy/multi-step-form/src/lib/steps/tos-step.ts`

```ts
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { FormField, type FieldTree } from '@angular/forms/signals';
import type { TosItem } from '../flow-options';
import type { TosAck } from '../flow-model';
import { FieldError } from '../field-error';

@Component({
  selector: 'tommy-tos-step',
  imports: [FormField, FieldError],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let f = field();
    <div class="ui-stack">
      @for (ack of f; track $index; let i = $index) {
        @let item = items()[i];
        <label class="ui-tos-item">
          <input type="checkbox" [formField]="ack.accepted" />
          <span class="ui-field">
            <span>
              <strong>{{ item.title }}</strong>
              @if (item.required) { <span class="ui-required">*</span> }
            </span>
            <span class="ui-muted">{{ item.body }}</span>
            <tommy-field-error [field]="ack.accepted" [show]="showErrors()" />
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

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm nx test tommy-multi-step-form`
Expected: PASS — both step specs green; no `.touched()` left in step templates.

- [ ] **Step 7: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/steps/
git commit -m "refactor(multi-step-form): steps reveal errors via FieldError, not on blur"
```

---

### Task 4: Wire the banner + always-clickable buttons into the flow container

**Goal:** Show the banner between the indicator and the step, remove `[disabled]` from Next/Submit so they are always clickable (clicking on an invalid step reveals errors instead of advancing), and route the handled server error through the banner/inline instead of a duplicate paragraph.

**Files:**
- Modify: `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`
- Modify: `libs/tommy/multi-step-form/src/lib/multi-step-flow.html`
- Modify: `libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts`

**Acceptance Criteria:**
- [ ] Blurring a field before pressing Next shows no error and no banner.
- [ ] Clicking Next on an invalid step does not advance, shows the banner (`role="alert"`) listing the step's errors, and shows inline errors.
- [ ] Next and Submit are never rendered with a `disabled` attribute.
- [ ] Fixing the fields removes the banner live; Next then advances.
- [ ] A server-rejected submit returns to the account step and surfaces the message via the banner + inline (asserted inside `[role=alert]`).
- [ ] Happy path still reaches the confirmation id.

**Verify:** `pnpm nx test tommy-multi-step-form && pnpm nx lint tommy-multi-step-form && pnpm nx build tommy-multi-step-form` → all pass.

**Steps:**

- [ ] **Step 1: Add the new container specs (failing)** — append inside the `describe('MultiStepFlow', …)` block in `libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts`

```ts
  it('does not show errors or the banner on blur, before Next is pressed', async () => {
    const fixture = await startFlow();
    const el = fixture.nativeElement as HTMLElement;
    const firstName = el.querySelector<HTMLInputElement>('#ms-firstName');
    firstName?.dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.ui-error')).toBeNull();
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('reveals the banner + inline errors when Next is clicked on an invalid step, and stays put', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('First name'); // still on the profile step
    const alert = el.querySelector('[role=alert]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('First name is required');
    expect(el.querySelectorAll('.ui-error').length).toBeGreaterThan(0);
  });

  it('keeps the Next button enabled even when the step is invalid', async () => {
    const fixture = await startFlow();
    const el = fixture.nativeElement as HTMLElement;
    const next = Array.from(el.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === 'Next',
    );
    expect(next).toBeDefined();
    expect(next?.disabled).toBe(false);
  });

  it('clears the banner live once the step becomes valid, then advances', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next'); // reveal errors on the (empty) profile step
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();

    setInput(fixture, '#ms-firstName', 'Tommy');
    setInput(fixture, '#ms-lastName', 'C');
    setInput(fixture, '#ms-email', 'tommy@example.com');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).toBeNull();

    clickButton(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Username');
  });
```

Also update the existing server-error test body to assert the banner carries the message:

```ts
  it('surfaces a server "username taken" error on the account step', async () => {
    stub.taken.add('taken');
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'taken');

    clickButton(fixture, 'Submit');
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Username'); // back on the account step
    const alert = el.querySelector('[role=alert]');
    expect(alert?.textContent).toContain('already taken'); // surfaced via the banner
  });
```

- [ ] **Step 2: Run the spec to verify the new tests fail**

Run: `pnpm nx test tommy-multi-step-form`
Expected: FAIL — no `[role=alert]` element exists yet; Next is still `disabled` on an invalid step.

- [ ] **Step 3: Update the container component** — `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`

Add the `ErrorBanner` import and register it:

```ts
import { ErrorBanner } from './error-banner';
```
```ts
  imports: [ProfileStep, AccountStep, TosStep, StepIndicator, ErrorBanner],
```

Replace the `currentStepValid` computed (the `switch`-based one) with a shared FieldState accessor plus a banner-message computed:

```ts
  /** The active step's field state. Returns the concrete FieldState per step so
   *  we only ever read the common `valid` / `errorSummary` signals on the union. */
  private readonly currentStepState = computed(() => {
    const ff = this.flowForm();
    if (!ff) return null;
    switch (this.currentStep()) {
      case 'profile': return ff.form.profile();
      case 'account': return ff.form.account();
      case 'tos': return ff.form.tos();
    }
  });

  /** Validity of just the active step's slice — gates "Next"/"Submit". */
  protected readonly currentStepValid = computed((): boolean => {
    const state = this.currentStepState();
    return state ? state.valid() : false;
  });

  /** One message per invalid field on the active step — only after Next pressed.
   *  `errorSummary()` aggregates the node's errors + all descendants'. Dedupe by
   *  field (first message) so the list mirrors the inline messages exactly. */
  protected readonly stepErrorMessages = computed<readonly string[]>(() => {
    if (!this.showErrors()) return [];
    const state = this.currentStepState();
    if (!state) return [];
    const seen = new Set<unknown>();
    const messages: string[] = [];
    for (const error of state.errorSummary()) {
      if (error.fieldTree) {
        if (seen.has(error.fieldTree)) continue;
        seen.add(error.fieldTree);
      }
      if (error.message) messages.push(error.message);
    }
    return messages;
  });
```

In `onSubmit()`, drop the `submitError.set(...)` line in the *handled* server-reject branch (keep returning the field errors so they attach to `account.username`); leave the `catch` block's `submitError.set(...)` for unexpected/thrown errors. The branch becomes:

```ts
          if (result.ok) {
            this.confirmationId.set(result.confirmationId);
            return null;
          }
          return result.fieldErrors.map((e) => ({
            kind: 'server',
            message: e.message,
            fieldTree: field.account.username,
          }));
```

(Leave `next()`, `back()`, `start()`, `reset()`, and the `submitError` signal declaration unchanged. `submitError` is now set only in the `catch`.)

- [ ] **Step 4: Update the template** — `libs/tommy/multi-step-flow.html` (the `@case ('form')` block)

```html
    @case ('form') {
      @if (flowForm(); as ff) {
        <tommy-step-indicator [labels]="stepLabels" [activeIndex]="stepIndex()" />
        <tommy-error-banner [messages]="stepErrorMessages()" />

        @switch (currentStep()) {
          @case ('profile') {
            <tommy-profile-step [field]="ff.form.profile" [showErrors]="showErrors()" />
          }
          @case ('account') {
            <tommy-account-step [field]="ff.form.account" [showErrors]="showErrors()" />
            @if (submitError()) {
              <p class="ui-error">{{ submitError() }}</p>
            }
          }
          @case ('tos') {
            <tommy-tos-step [field]="ff.form.tos" [items]="options()?.tos ?? []" [showErrors]="showErrors()" />
          }
        }

        <div class="ui-row">
          <button type="button" class="ui-btn" [disabled]="isFirst()" (click)="back()">Back</button>
          @if (isLast()) {
            <button type="button" class="ui-btn ui-btn-primary" (click)="onSubmit()">Submit</button>
          } @else {
            <button type="button" class="ui-btn ui-btn-primary" (click)="next()">Next</button>
          }
        </div>
      }
    }
```

(Only the form case changes: banner added; `[disabled]="!currentStepValid()"` removed from both Next and Submit. The `submitError` paragraph stays — it now shows only the unexpected/thrown error.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm nx test tommy-multi-step-form`
Expected: PASS — all container specs green, including the happy path and the updated server-error test.

- [ ] **Step 6: Lint + AOT build (catches strict-template / NG8022 issues)**

Run: `pnpm nx lint tommy-multi-step-form && pnpm nx build tommy-multi-step-form`
Expected: both succeed with no errors (confirms the generic `FieldError` binding and the FieldState union compile under `strictTemplates`).

- [ ] **Step 7: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib/multi-step-flow.ts \
        libs/tommy/multi-step-form/src/lib/multi-step-flow.html \
        libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts
git commit -m "feat(multi-step-form): error banner + always-clickable nav, deferred to Next"
```

---

## Self-review

**Spec coverage:**
- §1 FieldError → Task 2 (component) + Task 3 (wired into steps). ✓
- §2 ErrorBanner → Task 1. ✓
- §3 container computeds → Task 4 (`currentStepState` refines the spec's `currentStepField` to return FieldState directly, avoiding `FieldTree<unknown>` invariance; behavior identical). ✓
- §4 template (banner + remove disabled) → Task 4 Step 4. ✓
- §5 step components drop `touched()` → Task 3. ✓
- §6 server-error single source of truth → Task 4 Step 3. ✓
- §7 styles → Task 1 Step 4. ✓
- All acceptance criteria map to a test in Tasks 1–4. ✓

**Placeholder scan:** none — every code/test step contains full content.

**Type consistency:** `FieldError<T>` inputs `field`/`show` used consistently in all three steps; `stepErrorMessages`/`currentStepValid` both read from `currentStepState`; `ErrorBanner.messages` bound to `stepErrorMessages()` (both `readonly string[]`). ✓

**Notes / risks:**
- `errorSummary()` is verified present in the installed runtime (`_validation_errors-chunk.mjs`).
- `FieldError` emits `<span>` (not `<p>`) specifically so it is valid HTML inside the TOS step's `<span class="ui-field">`.
- An empty email yields only the `required` message (the `email` validator passes on empty), so the banner shows one line per field.
