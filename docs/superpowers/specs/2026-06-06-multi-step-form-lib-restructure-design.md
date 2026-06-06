# Multi-step form: lib/ folder restructure

**Date:** 2026-06-06
**Library:** `libs/tommy/multi-step-form` (`@tommy/multi-step-form`)
**Status:** Approved (Option A — group by concern)

## Problem

After the deferred-errors + banner work, `libs/tommy/multi-step-form/src/lib/`
holds ~19 files at its root, mixing three distinct concerns: the feature
container, the domain/form-construction logic, and the shared presentational
components. Only `steps/` is grouped. The flat root makes the lib harder to scan
and obscures the layering.

## Goal

Group the lib files by responsibility into subfolders so the structure reflects
the architecture, without changing any behavior or the public API.

## Non-goals

- No behavior changes, no test-content changes (specs move with their sources).
- No change to the public API (`src/index.ts` still exports only `MultiStepFlow`).
- No new per-folder barrel files (direct relative imports are kept).
- No renames — only moves and the import-path updates they force.

## Target structure (Option A)

```
lib/
  multi-step-flow.ts / .html / .css / .spec.ts   # container (entry); unchanged paths
  model/                                          # domain + form construction
    flow-model.ts
    flow-options.ts
    flow-schema.ts  (+ flow-schema.spec.ts)
    create-flow-form.ts  (+ create-flow-form.spec.ts)
    flow.service.ts  (+ flow.service.spec.ts)
  ui/                                             # shared presentational + design layer
    error-banner.ts  (+ error-banner.spec.ts)
    field-error.ts  (+ field-error.spec.ts)
    step-indicator.ts
    ui.css
  steps/                                          # unchanged location
    profile-step.ts
    account-step.ts
    tos-step.ts
    steps.spec.ts
```

The container stays at the lib root as the obvious entry point; its `templateUrl`
/ `styleUrl` (`./multi-step-flow.html` / `./multi-step-flow.css`) are unaffected.

## Moves (use `git mv` to preserve history)

| From `lib/` | To |
| --- | --- |
| `flow-model.ts` | `model/flow-model.ts` |
| `flow-options.ts` | `model/flow-options.ts` |
| `flow-schema.ts` (+ `.spec.ts`) | `model/flow-schema.ts` (+ `.spec.ts`) |
| `create-flow-form.ts` (+ `.spec.ts`) | `model/create-flow-form.ts` (+ `.spec.ts`) |
| `flow.service.ts` (+ `.spec.ts`) | `model/flow.service.ts` (+ `.spec.ts`) |
| `error-banner.ts` (+ `.spec.ts`) | `ui/error-banner.ts` (+ `.spec.ts`) |
| `field-error.ts` (+ `.spec.ts`) | `ui/field-error.ts` (+ `.spec.ts`) |
| `step-indicator.ts` | `ui/step-indicator.ts` |
| `ui.css` | `ui/ui.css` |

## Import updates (the only edits beyond the moves)

Files within `model/` move together, so imports among them (`./flow-options`,
`./flow-model`, `./flow-schema`) need NO change. Same for files within `ui/`.
Only cross-boundary references change:

- **`steps/profile-step.ts`** and **`steps/account-step.ts`:**
  `../flow-model` → `../model/flow-model`; `../field-error` → `../ui/field-error`
- **`steps/tos-step.ts`:** `../flow-options` → `../model/flow-options`;
  `../flow-model` → `../model/flow-model`; `../field-error` → `../ui/field-error`
- **`steps/steps.spec.ts`:** `../flow-options` → `../model/flow-options`;
  `../flow-model` → `../model/flow-model`; `../flow-schema` → `../model/flow-schema`
  (its `./profile-step` / `./account-step` / `./tos-step` imports stay)
- **`multi-step-flow.ts`:** `./flow.service` → `./model/flow.service`;
  `./create-flow-form` → `./model/create-flow-form`;
  `./flow-options` → `./model/flow-options`; `./flow-model` → `./model/flow-model`;
  `./step-indicator` → `./ui/step-indicator`; `./error-banner` → `./ui/error-banner`
  (the `./steps/*` imports stay)
- **`multi-step-flow.spec.ts`:** `./flow.service` → `./model/flow.service`;
  `./flow-options` → `./model/flow-options` (its `./multi-step-flow` import stays)

## External reference (one)

- **`apps/tommy/host/project.json`** `targets.build…styles`:
  `libs/tommy/multi-step-form/src/lib/ui.css` →
  `libs/tommy/multi-step-form/src/lib/ui/ui.css`.
- `apps/tommy/host/src/styles.css` uses `@source '…/libs/tommy/multi-step-form';`
  — a directory glob, so it is unaffected.

No other file outside the lib imports its internals (verified: `index.ts` only
re-exports `./lib/multi-step-flow`; no cross-lib deep imports exist).

## Verification

`pnpm nx test tommy-multi-step-form && pnpm nx lint tommy-multi-step-form && pnpm nx build tommy-host`

- Tests green (no spec content changed) → behavior preserved.
- Lint clean → no unused/dangling imports left.
- `tommy-host` AOT build green → the moved `ui.css` path and every rewired
  import resolve under `strictTemplates`.

## Risks / notes

- The only easy-to-miss edit is the host `project.json` `ui.css` path; the AOT
  host build (or a missing banner style) catches it if wrong.
- `git mv` keeps blame/history on the moved files.
