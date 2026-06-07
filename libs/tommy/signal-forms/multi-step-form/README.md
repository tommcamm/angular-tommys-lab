# Multi-Step Form

Experiment #2 in the Tommy Labs workspace: a **signup-style multi-step wizard** built
on Angular 21's experimental signal forms (`@angular/forms/signals`). Where
experiment #1 (`@tommy/signal-forms/simple-form`) is a single flat form, this one explores the
patterns you reach for in a real flow.

## What it demonstrates

- **Backend-driven validation** — a simulated backend (`FlowService`) returns
  `FlowOptions` (e.g. username min/max length, password min length) when the flow
  starts; the schema is _parameterized_ by those constraints.
- **Reusable, composed schemas** — `profileSchema` and `accountSchema(options)` are
  composed onto one root model via `apply` / `applyEach` in `flowSchema(options)`.
- **Cross-field validation** — `confirmPassword` must match `password`, via a
  `validate` rule that reads the sibling value (`ctx.valueOf(p.password)`).
- **A dynamic array** — a 0..\* Terms-of-Service list; each required item must be
  acknowledged (`applyEach` over the `tos` array).
- **The `submit()` server-error pathway** — on submit, a server "username taken"
  rejection is mapped back onto the username field and the user is returned to the
  account step.
- **One root form, built after load** — `createFlowForm(options, injector)` builds
  the form inside `runInInjectionContext` once the options resolve. Step components
  receive a `FieldTree` slice as an input; the container owns phase/step state,
  validity-gated navigation, and submit.

## Flow

```
intro ─(Start ▸ spinner)→ [ profile → account → tos ] ─(Submit ▸ spinner)→ done
  ▲ back from profile (form preserved)  │                                  └─(server error)→ account
                                        ▲ back / next, per-step validity
```

`Start` and `Submit` no longer swap to interstitial screens: the button greys out
with an inline spinner and the view changes only once the work resolves (`starting`
/ `submitting` booleans, not phases). The phase machine is just `intro | form | done`.

## File map

| File                                                      | Responsibility                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `flow-options.ts`                                         | Backend contract types: `FlowOptions`, `TosItem`, `FlowSubmission`, `SubmitResult`.                 |
| `flow.service.ts`                                         | Simulated backend (Promises + `setTimeout`); deterministic — username `"taken"` is always rejected. |
| `flow-model.ts`                                           | Form model (`ProfileGroup`/`AccountGroup`/`TosAck`/`FlowModel`) + `emptyFlowModel(options)`.        |
| `flow-schema.ts`                                          | Reusable `profileSchema`, `accountSchema(options)`, and the composed `flowSchema(options)`.         |
| `create-flow-form.ts`                                     | `createFlowForm(options, injector)` → `{ model, form }`, built via `runInInjectionContext`.         |
| `steps/profile-step.ts`, `account-step.ts`, `tos-step.ts` | Presentational, OnPush; render a `FieldTree` slice via `[formField]`.                               |
| `step-indicator.ts`                                       | "Step n of N" indicator.                                                                            |
| `multi-step-flow.ts`                                      | Entry component: the phase/step state machine + submit. Exported as `MultiStepFlow`.                |
| `ui.css`                                                  | The `.ui-*` design layer (see Styling).                                                             |

## Running unit tests

Run `pnpm nx test tommy-signal-forms-multi-step-form` to execute the unit tests (logic-first:
schemas, the service, and DOM-driven container tests for the happy path and the
server-error path).

## Styling

**Path taken: Tailwind v4 (plain-CSS `ui.css`, no spartan-ng components).**

### Packages installed

- `tailwindcss@4.3.0` (devDependency)
- `@tailwindcss/postcss@4.3.0` (devDependency)

### What was set up

- `.postcssrc.json` at the repo root activates `@tailwindcss/postcss` for the esbuild Angular builder.
- `apps/tommy/host/src/styles.css` imports only Tailwind's **theme tokens + utilities** (`tailwindcss/theme.css` + `tailwindcss/utilities.css`) and adds a `@source` directive pointing at this lib so template utilities are picked up. Tailwind's **preflight** (global reset) is intentionally omitted, because this host also renders the home page and the signal-forms experiment whose CSS was written against browser defaults — a global reset would alter their cascade.
- `libs/tommy/signal-forms/multi-step-form/src/lib/ui/ui.css` is the single design-layer file: it defines all `.ui-*` semantic classes (plain CSS — no `@apply`). This file is registered in the host build's `styles` array so global styles reach lib components regardless of view encapsulation.

### Why not spartan-ng

`@spartan-ng/helm` does not exist on npm — spartan-ng distributes individual component packages (e.g. `@spartan-ng/ui-button-helm`). Since the `.ui-*` design layer is hand-authored CSS and no spartan-ng primitives are used in any component yet, there was no value in installing individual spartan-ng packages at this stage. They can be added per-component later if richer components are wanted.

### Design decisions

- Components reference **only** `.ui-*` class names — no raw Tailwind utilities in templates.
- Swapping the styling engine (e.g. to `@apply`-based Tailwind or to a component library) requires only editing `ui.css`, not any component template.
