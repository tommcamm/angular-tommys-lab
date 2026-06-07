# Multi-Step Form — UX & Validation Improvements

**Date:** 2026-06-07
**Lib:** `libs/tommy/signal-forms/multi-step-form`
**Status:** Approved (design)

## Goal

Improve the multi-step signal-forms experiment so it follows Angular 21 best
practices and uses signal forms the way they're intended — without
overcomplicating. Five changes, all confined to the existing files (no new
files except the spec):

1. Replace the full-screen "Loading…" interstitial on Start with an inline
   spinner + disabled button; only change page once options have loaded.
2. Group the Back button with Next/Submit on the right, and let Back on the
   first step return to the intro page.
3. Rework validation reveal: errors appear on Next, an edited field's inline
   error clears and does **not** reappear until the next Next press, and the
   yellow banner is a frozen per-step snapshot that changes only on Next.
4. Keep the panel the same size across every step (including intro).
5. Cleanups for reusability/consistency (shared spinner, Submit gets the same
   inline-spinner treatment as Start).

## Confirmed decisions

- **Back → intro preserves data.** The built form is kept; pressing Start again
  resumes at Profile with values intact (no re-fetch, no second spinner).
- **Submit gets the same spinner pattern as Start.** The form panel stays
  visible during submit; the Submit button greys out with an inline spinner.
- **Panel sizing:** equal `min-height` sized to the tallest step (TOS), with the
  nav row pinned to the bottom of the card.

---

## 1. Phase machine + loading/submitting spinners

Today: `intro | loading | form | submitting | done | error`, where `loading`
and `submitting` are full-screen interstitials.

**New:** collapse to `intro | form | done`. The interstitials become inline
button states driven by booleans:

- `starting = signal(false)`, `loadError = signal<string | null>(null)`,
  `submitting = signal(false)`.
- `start()` stays on the **intro** screen, sets `starting`, disables the Start
  button, shows an inline spinner. On success → `phase = 'form'`; on failure →
  stay on intro and render `loadError` inline (Start button doubles as retry).
  `finally { starting.set(false) }`.
- **Resume:** `start()` short-circuits when a form already exists:
  `if (this.flowForm()) { this.phase.set('form'); return; }` — no re-fetch, no
  spinner, data preserved (supports Back → intro → Start).
- `onSubmit()` sets `submitting` instead of switching to a phase; the form stays
  visible with the Submit button disabled + spinner. Success → `phase = 'done'`;
  server error / thrown → stay on the form (account step) with the frozen
  banner; `finally { submitting.set(false) }`.
- The `loading` and `error` phases are removed.

A shared `.ui-spinner` CSS class (rendered as an `aria-hidden` span) is used by
both the Start and Submit buttons.

## 2. Button grouping + Back-to-intro

- `.ui-row`: `justify-content` changes from `space-between` to `flex-end`, so
  **Back and Next/Submit sit together on the right**, Back to the left of Next.
- Back is **never disabled**:
  - On the first step (`profile`) it returns to intro: `this.phase.set('intro')`
    (form preserved).
  - On later steps it decrements `stepIndex`.
- Navigation does **not** reset validation state (see §3).

## 3. Validation: frozen banner + clear-on-edit inline errors

The single live `showErrors` boolean is replaced by a **per-step gate** that
leans on signal-forms' own `reset()` and `dirty()` rather than re-implementing
field state.

```ts
type StepKey = 'profile' | 'account' | 'tos';
// null  = step not yet validated (no Next pressed here yet)
// []    = validated and clean (banner cleared)
// [...] = validated and invalid; the frozen banner snapshot
gate = signal<Record<StepKey, readonly string[] | null>>({
  profile: null, account: null, tos: null,
});
```

Derived signals (scoped to the current step):

- `attempted = computed(() => gate()[currentStep()] !== null)`
- `bannerMessages = computed(() => gate()[currentStep()] ?? [])`

**`validateStep()`** (called by both `next()` and submit):

```ts
const state = currentStepState();      // the step's FieldState
const step  = currentStep();
if (state.valid()) {
  setGate(step, []);                   // clears the banner for this step
  return true;
}
setGate(step, snapshotMessages(state)); // frozen banner = errorSummary snapshot
state.reset();                          // clear dirty/touched on the subtree
return false;                           // (values untouched → validity unchanged)
```

`snapshotMessages` reuses the existing dedupe-by-`fieldTree` logic over
`state.errorSummary()`.

**Banner behavior:** the banner reads `bannerMessages()`, a *stored snapshot* —
not a `computed` over `errorSummary()`. Therefore:

- Editing fields never changes the banner.
- It changes only when Next/Submit is pressed again.
- A clean Next leaves `[]`, so returning to that step shows no banner.
- Returning to a previously-validated invalid step shows its stored banner.

**Inline errors (`FieldError`):** gate becomes
`attempted && invalid() && !dirty()`:

- Right after a Next press, `reset()` made every field `!dirty`, so all
  currently-invalid fields show their inline error.
- The first edit to a field makes it `dirty` → its inline error hides and stays
  hidden (even for a new invalid value) until the next Next press calls `reset()`
  again.
- Before any Next press on the step, `attempted` is false → nothing shows
  (preserves the "no errors on blur" behavior).

**Server-error path (`onSubmit`):** on rejection, call `account.reset()` first,
then store the server message into `gate.account` and return to the account
step. The server error attaches to `username` (now invalid + `!dirty`) so it
shows inline and in the banner. Editing `username` auto-clears the server error
(signal-forms `linkedSignal`) and marks it dirty → inline hides; the banner
persists until the next press.

**Navigation:** `back()`/`next()` do **not** mutate `gate`; per-step state
persists, which is exactly what makes "the banner changes only on Next" hold
across navigation.

## 4. Panel consistency

`.ui-card` becomes a flex column (`display: flex; flex-direction: column`) with a
`min-height` sized to the tallest step (TOS). The `.ui-row` nav gets
`margin-top: auto` to pin it to the bottom of the card. Width stays at the
current `32rem` (`max-width`). Intro/done screens get the same min-height with
empty space below. The exact `min-height` value is verified by running the app.

## 5. Reusability / cleanup

- `FieldError`: `show` input keeps its name; its documented meaning becomes "the
  step has been validated", and the `&& !state.dirty()` clause lives inside the
  component (one small, well-contained change to the template gate).
- New shared `.ui-spinner` class in `ui.css`, used by Start and Submit.
- No new files; changes land in `multi-step-flow.ts` / `.html` / `.css`,
  `ui/field-error.ts`, and `ui/ui.css`.

## Testing impact

- **Rewrite** `multi-step-flow.spec.ts` "clears the banner live once the step
  becomes valid" — it asserts the old live behavior. New assertions: after
  editing fields the banner **persists** (frozen); it clears only when Next is
  pressed, which then advances.
- **Keep passing:** happy path, server "username taken", unexpected-submit-error,
  "no errors/banner on blur before Next", "reveals banner + inline on invalid
  Next", "Next stays enabled when invalid".
- **Add coverage:**
  - Start disables the button + shows a spinner while loading, then advances.
  - Back on Profile returns to intro; Start resumes with data preserved (no
    re-fetch).
  - Inline error clears when a field is edited and does **not** reappear on a new
    invalid value until Next is pressed again.
  - Submit disables its button + shows a spinner during submit.
- `field-error.spec.ts`: existing tests still pass (pristine field with
  `show=true` is `!dirty` → shows; becoming valid hides regardless of dirty). Add
  a case: a `dirty` invalid field with `show=true` shows nothing.

## Non-goals

- No backend/service changes (`FlowService`, `flow-options.ts`).
- No schema/model changes (`flow-schema.ts`, `flow-model.ts`).
- No step-indicator changes.
- No new styling engine; only additions to `ui.css`.
