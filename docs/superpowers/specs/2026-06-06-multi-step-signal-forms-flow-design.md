# Multi-Step Signal Forms Flow — Design

- **Date:** 2026-06-06
- **Experiment:** #2, `@tommy/multi-step-form`
- **Stack:** Nx monorepo · Angular 21.2.9 · `@angular/forms/signals` (experimental) · Vitest · spartan-ng + Tailwind (with plain-CSS fallback)
- **Status:** Approved — ready for implementation planning

## 1. Goal

A signup-style **wizard** that demonstrates signal-forms capabilities the first
experiment (`@tommy/signal-forms`) does not:

- **Backend-driven validation** — constraints (e.g. username min length) arrive at
  runtime and parameterize the schema.
- **Reusable, composed schemas** — independent per-step schemas combined into one
  flow schema via `apply` / `applyEach`.
- **Cross-field validation** — confirm-password must match password.
- **A dynamic array** — a 0..\* list of Terms-of-Service items, each acknowledged.
- **The `submit()` server-error pathway** — server-side rejections mapped back to
  field errors.

Steps **replace** the rendered component (component swap via `@switch`), not routing.

Non-goal: graphic polish. "Neat, not fancy." Focus stays on using signal forms as
Angular 21 intends.

## 2. Phases & steps

```
intro ─(Start)→ loading ─→ [ profile → account → tos ] ─(Submit)→ submitting ─→ done
                                 ▲ back / next, gated by per-step validity         └─(server error)→ back to tos
```

| Phase / step | Content |
| --- | --- |
| `intro` | A single "Start" button. No form exists yet. |
| `loading` | Fetch `FlowOptions` + TOS list from the simulated backend, then build the form. |
| `profile` (step 1) | `firstName`, `lastName`, `email`. |
| `account` (step 2) | `username` (min/max length **from backend**), `password` (min length from backend), `confirmPassword` (**cross-field match**). |
| `tos` (step 3) | One checkbox per TOS item; required items must be ticked. Submit happens here. |
| `submitting` | Awaiting the simulated backend. |
| `done` | Completion view with returned `confirmationId` + "Start over" reset. |

## 3. Types & model

```ts
// "Backend" contract
interface TosItem { id: string; title: string; body: string; required: boolean; }
interface FlowOptions {
  username: { minLength: number; maxLength: number };
  password: { minLength: number };
  tos: TosItem[]; // 0..*
}

// Form model — single source of truth
interface ProfileGroup { firstName: string; lastName: string; email: string; }
interface AccountGroup { username: string; password: string; confirmPassword: string; }
interface TosAck      { id: string; required: boolean; accepted: boolean; } // self-describing
interface FlowModel   { profile: ProfileGroup; account: AccountGroup; tos: TosAck[]; }
```

`TosAck` carries `required` so the per-item schema is self-contained — no index
lookups back into `FlowOptions`.

## 4. Schemas — reusable, parameterized, composed

```ts
const profileSchema = schema<ProfileGroup>((p) => {
  required(p.firstName);
  required(p.lastName);
  required(p.email);
  email(p.email);
});

function accountSchema(o: FlowOptions) {            // parameterized by backend options
  return schema<AccountGroup>((p) => {
    required(p.username);
    minLength(p.username, o.username.minLength);
    maxLength(p.username, o.username.maxLength);
    required(p.password);
    minLength(p.password, o.password.minLength);
    required(p.confirmPassword);
    validate(p.confirmPassword, (ctx) =>            // cross-field
      ctx.value() === ctx.valueOf(p.password) ? null : passwordsMismatchError());
  });
}

const tosItemSchema = schema<TosAck>((p) => {
  validate(p.accepted, (ctx) =>
    ctx.valueOf(p.required) && !ctx.value() ? mustAcceptError() : null);
});

function flowSchema(o: FlowOptions) {
  return schema<FlowModel>((p) => {
    apply(p.profile, profileSchema);
    apply(p.account, accountSchema(o));
    applyEach(p.tos, tosItemSchema);               // dynamic array
  });
}

function emptyFlowModel(o: FlowOptions): FlowModel; // seeds tos[] from o.tos
```

A `createFlowForm(opts, injector)` factory mirrors `createSignupForm` from
experiment #1: it builds the model signal and calls `form(model, flowSchema(opts))`
inside `runInInjectionContext(injector, …)`. The form is built **after** load, so
constraints are baked into the schema.

> Note on cross-field reads: the exact `FieldContext` API for reading a sibling
> (`ctx.valueOf(path)` vs. equivalent) will be confirmed against the installed
> typings during implementation. The primitive (`validate` + reading another
> field's value) is verified to exist; only the precise call shape is to be
> pinned down.

## 5. Simulated backend — `FlowService`

Injectable, provided at the experiment's route. Plain Promises with a `setTimeout`
delay (no HTTP):

- `loadOptions(): Promise<FlowOptions>` — ~600 ms; returns canned constraints plus a
  couple of TOS items (one `required`, one optional).
- `submitFlow(payload): Promise<SubmitResult>` — **deterministic**: username
  `"taken"` is rejected and mapped to a server field error (exercises the
  `submit()` server-error path); any other input succeeds with a
  `confirmationId`. No randomness, so tests stay deterministic.

## 6. Components

- **`MultiStepFlow`** — lib entry, lazy-loaded, OnPush. Owns the `phase`/`step`
  signals, the built form, navigation (`next`/`back` gated on
  `form.profile().valid()`, `form.account().valid()`, `form.tos().valid()`), and
  `submit()`. Renders the active step via `@switch`. Provides `FlowService`.
- **`ProfileStep`, `AccountStep`, `TosStep`** — presentational, OnPush. Each takes
  `field = input.required<FieldTree<…>>()` and binds `[formField]`. `TosStep` also
  receives `TosItem[]` for display text, separating backend content from form state.
- **`StepIndicator`** — presentational "Step _n_ of 3" stepper.

Navigation buttons live in the container. "Next" is disabled until the current
step's slice is valid; the final step's button runs submit. Steps are pure field
renderers, so they are trivially testable in isolation.

## 7. Styling — spartan-ng + Tailwind

helm components used: card, button, input, label, checkbox (plus progress/steps if
available).

**Risk:** Angular 21 is very new; spartan-ng may not officially support it yet on
Nx + Vite/analog. **Mitigation:** the implementation plan's first step validates a
clean spartan-ng install. If it will not cooperate on Angular 21, fall back to
plain CSS matching experiment #1. The signal-forms logic is identical either way —
only the presentational layer changes.

## 8. Testing (logic-first, mirroring experiment #1)

Vitest via `TestBed.runInInjectionContext`:

- `profileSchema`: required + email validity.
- `accountSchema(opts)`: username min/max length from options; confirm match vs.
  mismatch.
- `tosItemSchema`: required-not-ticked invalid; optional ignored; accepted valid.
- `flowSchema` composition: whole form valid only when all groups valid;
  `form().value()` shape.
- `emptyFlowModel`: seeds TOS array from options.
- `FlowService`: `loadOptions` shape; `submitFlow` success + `"taken"` rejection.
- One `MultiStepFlow` smoke test (intro → start → renders step 1).

## 9. Host wiring

- New lib `libs/tommy/multi-step-form`, tag `scope:tommy`.
- `@tommy/multi-step-form` path alias in `tsconfig.base.json`.
- Export `MultiStepFlow` from the lib barrel.
- **One** new entry in `apps/tommy/host/src/app/experiments.ts`
  (slug `multi-step-form`) — nav, landing card, and route derive from it.

## 10. Out of scope (YAGNI)

Real HTTP, persistence across reloads, per-step routing/URLs, i18n, and async
username availability via `validateHttp`/`validateAsync` (noted as a possible later
stretch, not built now).
