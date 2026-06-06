# Multi-step form: deferred errors + summary banner

**Date:** 2026-06-06
**Library:** `libs/tommy/multi-step-form` (`@tommy/multi-step-form`)
**Status:** Approved (Approach B)

## Problem

The multi-step sign-up flow currently surfaces validation errors in a way that
contradicts the desired UX:

1. **Errors appear on blur.** Each field shows its error when
   `(showErrors() || field.touched()) && field.invalid()`. The `touched()` term
   means an error pops up as soon as the user leaves a field — before they have
   asked to move on.
2. **Next/Submit are disabled when the step is invalid.**
   `[disabled]="!currentStepValid()"` prevents the user from clicking forward at
   all. As a side effect, the `showErrors.set(true)` lines inside `next()` and
   `onSubmit()` are unreachable dead code — they can only fire on a click that
   the disabled attribute forbids.
3. **No summary.** There is no single place that tells the user "here is
   everything wrong on this step."

## Goals

- Validation errors (inline labels) appear **only after the user presses Next**
  (or Submit) — never on blur.
- **Next and Submit are always clickable.** Clicking on an invalid step reveals
  the errors and the banner instead of advancing/submitting.
- A **yellow warning banner** sits below the step indicator and above the
  fields, reading "One or more fields have errors:" followed by a bulleted list
  of the specific problems on the current step.
- Once errors are shown, they **clear live**: each inline error and its banner
  line disappears the moment its field becomes valid; the banner vanishes when
  the step is clean.
- Follow Angular + signal-forms best practices and match the existing
  presentational-component style of the library.

## Non-goals

- No changes to the validation rules, schema, model, flow service, or
  `createFlowForm`.
- No clickable "jump to field" behavior from banner items (YAGNI).
- No change to the loading / submitting / done / error / intro phases.

## Confirmed decisions

| Decision | Choice |
| --- | --- |
| Error surfaces | **Both** inline labels under each field **and** the summary banner. |
| Submit button | **Same behavior as Next** — always clickable, reveals errors when invalid. |
| Persistence after first failed Next | **Clear live** as fields become valid. |
| Approach | **B** — extract `FieldError` + `ErrorBanner` presentational components. |

## Key API used

`FieldState.errorSummary` — a signal containing a field's errors **and all of
its descendants'** errors. Verified present in the installed Angular 21.2.x
runtime (`_validation_errors-chunk.mjs`, `get errorSummary`) and types
(`_structure-chunk.d.ts`). Each entry is a `ValidationError.WithFieldTree`
carrying `kind`, optional `message`, and the originating `fieldTree`. Reading
`ff.form.<step>().errorSummary()` therefore yields every error on a step in one
call — including the cross-field "passwords must match" error and every per-item
TOS error.

## Design (Approach B)

### 1. `FieldError` presentational component — `src/lib/field-error.ts`

Replaces the seven duplicated inline `@if` blocks across the three step
components. Centralizes the single rule we are changing: *when does an error
become visible.*

```ts
selector: 'tommy-field-error'
inputs:
  field = input.required<FieldTree<unknown>>();   // e.g. f.firstName
  show  = input.required<boolean>();
template:
  @let s = field()();
  @if (show() && s.invalid()) {
    <p class="ui-error">{{ s.errors()[0]?.message }}</p>
  }
```

- "Clear live" is automatic: `s.invalid()` and `s.errors()` are reactive.
- Renders nothing when valid or when `show` is false.

### 2. `ErrorBanner` presentational component — `src/lib/error-banner.ts`

Pure, list-driven. Renders nothing when the list is empty.

```ts
selector: 'tommy-error-banner'
inputs:
  messages = input.required<readonly string[]>();
template:
  @if (messages().length) {
    <div class="ui-banner-warning" role="alert">
      <p class="ui-banner-title">
        <span aria-hidden="true">⚠</span> One or more fields have errors:
      </p>
      <ul class="ui-banner-list">
        @for (m of messages(); track $index) { <li>{{ m }}</li> }
      </ul>
    </div>
  }
```

- `role="alert"` so assistive tech announces it — appropriate because the banner
  appears on a deliberate Next/Submit press, not on every keystroke.
- Decoupled from signal-forms types: it receives plain `string[]`, computed in
  the container.

### 3. Container — `src/lib/multi-step-flow.ts`

Add a field-node accessor and a banner-message computed; simplify
`currentStepValid` to reuse the accessor.

```ts
/** The active step's field node. */
protected readonly currentStepField = computed(() => {
  const ff = this.flowForm();
  if (!ff) return null;
  switch (this.currentStep()) {
    case 'profile': return ff.form.profile;
    case 'account': return ff.form.account;
    case 'tos':     return ff.form.tos;
  }
});

protected readonly currentStepValid = computed(
  () => this.currentStepField()?.().valid() ?? false,
);

/** One message per invalid field on the active step — only after Next pressed. */
protected readonly stepErrorMessages = computed<readonly string[]>(() => {
  if (!this.showErrors()) return [];
  const summary = this.currentStepField()?.().errorSummary() ?? [];
  const seen = new Set<unknown>();
  const messages: string[] = [];
  for (const e of summary) {
    if (e.fieldTree && seen.has(e.fieldTree)) continue;
    if (e.fieldTree) seen.add(e.fieldTree);
    if (e.message) messages.push(e.message);
  }
  return messages;
});
```

Dedup-by-field-take-first makes the banner list mirror the inline errors exactly
(each inline error shows `errors()[0]`), so the banner and the per-field
messages stay in lock-step.

The existing `next()` / `back()` / `onSubmit()` logic is already correct once the
buttons are enabled — `next()` sets `showErrors` to `true` on an invalid step and
returns, and clears it on a successful advance. No control-flow changes needed
there beyond the server-error cleanup below.

### 4. Template — `src/lib/multi-step-flow.html`

- Insert the banner between the indicator and the step switch:
  ```html
  <tommy-step-indicator [labels]="stepLabels" [activeIndex]="stepIndex()" />
  <tommy-error-banner [messages]="stepErrorMessages()" />
  ```
- Remove `[disabled]="!currentStepValid()"` from **both** the Next and Submit
  buttons.
- Step components use `<tommy-field-error [field]="f.x" [show]="showErrors()" />`
  in place of their inline `@if` error blocks.

### 5. Step components — profile / account / tos

Each `(showErrors() || x.touched()) && x.invalid()` block becomes a
`<tommy-field-error>` usage. The `touched()` term is dropped entirely, satisfying
"errors appear only after Next." Import `FieldError`; drop the now-unused
`FormField`-adjacent error markup (keep `FormField` for the inputs).

### 6. Server-error cleanup (single source of truth)

A rejected submit attaches a `kind: 'server'` error to `account.username` via the
`submit()` action. That error now naturally appears in the banner *and* inline
under the username field (it is a real field error in `errorSummary()`).

- Stop setting `submitError` in the **handled** server-reject branch — let it
  flow through the banner + inline like any other field error.
- Keep `submitError` **only** for the unexpected/thrown case (the `catch`
  block), which is not a field error and so cannot appear in `errorSummary()`.
  Continue rendering that one as a standalone `ui-error` paragraph.

### 7. Styles — `src/lib/ui.css`

Add the yellow banner classes (design layer; components reference only `.ui-*`):

```css
.ui-banner-warning {
  border: 1px solid #d4a72c;       /* amber */
  background: #fff8c5;             /* light yellow */
  color: #4d2d00;
  border-radius: 0.5rem;
  padding: 0.75rem 1rem;
}
.ui-banner-title { margin: 0 0 0.25rem; font-weight: 600; font-size: 0.875rem; }
.ui-banner-list { margin: 0; padding-left: 1.25rem; font-size: 0.875rem; line-height: 1.5; }
```

## Files

- **Create:** `src/lib/field-error.ts`, `src/lib/error-banner.ts`
- **Modify:** `src/lib/multi-step-flow.ts`, `src/lib/multi-step-flow.html`,
  `src/lib/steps/profile-step.ts`, `src/lib/steps/account-step.ts`,
  `src/lib/steps/tos-step.ts`, `src/lib/ui.css`
- **Tests:** extend `multi-step-flow.spec.ts` (banner + always-clickable
  behavior) and add specs for the two new components; update `steps.spec.ts` if
  it asserts the old `touched()`-based visibility.

## Acceptance criteria

- [ ] On a fresh step, typing then blurring a field shows **no** error.
- [ ] Clicking Next on an invalid step does **not** advance, reveals inline
      errors, and shows the yellow banner with one line per invalid field.
- [ ] Next and Submit are never `[disabled]`.
- [ ] Fixing a field removes its inline error and its banner line immediately;
      the banner disappears once the step is valid; Next then advances.
- [ ] Submit on an invalid last step behaves like Next (reveals errors, no
      submit).
- [ ] A server-rejected submit returns to the account step and shows the server
      message via the banner + inline (not duplicated in a separate paragraph).
- [ ] An unexpected/thrown submit error still shows its standalone message.
- [ ] Banner has `role="alert"`; messages render as a `<ul>`.
- [ ] `nx lint`, `nx test`, and `nx build` for `tommy-multi-step-form` all pass
      (AOT build catches the NG8022 `[formField]` class of issues).

## Risks / notes

- `errorSummary()` field order: errors are aggregated in field/descendant order,
  so dedup-by-field preserves a stable, intuitive banner ordering.
- Two unaccepted required TOS items produce two banner lines with the same text
  (different fields) — acceptable; the inline per-item errors disambiguate.
- `[formField]` elements must not carry native validation attributes (NG8022) —
  unaffected here since no attributes are added, but verify via AOT `nx build`.
