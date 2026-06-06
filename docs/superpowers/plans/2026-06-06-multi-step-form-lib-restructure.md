# Multi-step form lib/ restructure — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize `libs/tommy/multi-step-form/src/lib/` into `model/` (domain + form construction) and `ui/` (shared presentational components + `ui.css`) subfolders, leaving the container at the lib root and `steps/` unchanged — no behavior or public-API change.

**Architecture:** Pure mechanical move. `git mv` each file into its new subfolder (preserving history), then rewire only the cross-boundary relative imports plus the one external `ui.css` path in the host app's build config. Files moving as a group keep their intra-group `./` imports unchanged. Verification is the existing test/lint/AOT suite — no test content changes.

**Tech Stack:** Angular 21.2.x, `@angular/forms/signals`, Nx, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-06-multi-step-form-lib-restructure-design.md`

**Conventions:** Run via `pnpm nx ...`. The lib has NO `build` target — the AOT/`strictTemplates` check is `pnpm nx build tommy-host` (the host app consuming the lib).

---

### Task 1: Move files into model/ and ui/, rewire imports

**Goal:** Relocate the domain and shared-presentational files into `model/` and `ui/` subfolders and update every affected import (internal relative paths + the host `ui.css` style entry), with the full existing suite still green.

**Files:**
- Move (git mv): `flow-model.ts`, `flow-options.ts`, `flow-schema.ts`, `flow-schema.spec.ts`, `create-flow-form.ts`, `create-flow-form.spec.ts`, `flow.service.ts`, `flow.service.spec.ts` → `model/`
- Move (git mv): `error-banner.ts`, `error-banner.spec.ts`, `field-error.ts`, `field-error.spec.ts`, `step-indicator.ts`, `ui.css` → `ui/`
- Modify (imports): `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`, `multi-step-flow.spec.ts`, `steps/profile-step.ts`, `steps/account-step.ts`, `steps/tos-step.ts`, `steps/steps.spec.ts`
- Modify (external): `apps/tommy/host/project.json`
- Unchanged: `multi-step-flow.html`, `multi-step-flow.css`, `src/index.ts`, `steps/` location

**Acceptance Criteria:**
- [ ] `lib/` root contains only `multi-step-flow.{ts,html,css,spec.ts}` plus the `model/`, `ui/`, `steps/` directories.
- [ ] `model/` contains the 8 domain files; `ui/` contains the 6 presentational/style files (incl. `ui.css`).
- [ ] No stale imports remain (no `from './flow-*'`, `'./error-banner'`, `'./field-error'`, `'./step-indicator'` at the container; no `'../flow-*'` / `'../field-error'` in `steps/`).
- [ ] `apps/tommy/host/project.json` references `…/src/lib/ui/ui.css`.
- [ ] `pnpm nx test tommy-multi-step-form` (31 tests), `pnpm nx lint tommy-multi-step-form`, and `pnpm nx build tommy-host` all pass.

**Verify:** `pnpm nx test tommy-multi-step-form && pnpm nx lint tommy-multi-step-form && pnpm nx build tommy-host` → all succeed.

**Steps:**

- [ ] **Step 1: Create the move with `git mv` (preserves history)**

```bash
cd libs/tommy/multi-step-form/src/lib
mkdir -p model ui
# domain + form construction -> model/
git mv flow-model.ts flow-options.ts \
       flow-schema.ts flow-schema.spec.ts \
       create-flow-form.ts create-flow-form.spec.ts \
       flow.service.ts flow.service.spec.ts model/
# shared presentational + design layer -> ui/
git mv error-banner.ts error-banner.spec.ts \
       field-error.ts field-error.spec.ts \
       step-indicator.ts ui.css ui/
cd -
git status --short   # expect renames only, no content changes yet
```

- [ ] **Step 2: Rewire the container — `libs/tommy/multi-step-form/src/lib/multi-step-flow.ts`**

Change these import lines (the `./steps/*` imports stay as-is):
```ts
import { FlowService } from './model/flow.service';
import { createFlowForm, type FlowForm } from './model/create-flow-form';
import type { FlowOptions, FlowSubmission } from './model/flow-options';
import type { FlowModel } from './model/flow-model';
import { ProfileStep } from './steps/profile-step';
import { AccountStep } from './steps/account-step';
import { TosStep } from './steps/tos-step';
import { StepIndicator } from './ui/step-indicator';
import { ErrorBanner } from './ui/error-banner';
```

- [ ] **Step 3: Rewire the container spec — `libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts`**

```ts
import { MultiStepFlow } from './multi-step-flow';
import { FlowService } from './model/flow.service';
import type { FlowOptions, FlowSubmission, SubmitResult } from './model/flow-options';
```
(The `./multi-step-flow` import is unchanged.)

- [ ] **Step 4: Rewire `steps/profile-step.ts` and `steps/account-step.ts`**

In `profile-step.ts` change the two cross-boundary imports:
```ts
import type { ProfileGroup } from '../model/flow-model';
import { FieldError } from '../ui/field-error';
```
In `account-step.ts`:
```ts
import type { AccountGroup } from '../model/flow-model';
import { FieldError } from '../ui/field-error';
```

- [ ] **Step 5: Rewire `steps/tos-step.ts`**

```ts
import type { TosItem } from '../model/flow-options';
import type { TosAck } from '../model/flow-model';
import { FieldError } from '../ui/field-error';
```

- [ ] **Step 6: Rewire `steps/steps.spec.ts`**

Change the three domain imports (the `./profile-step` / `./account-step` / `./tos-step` imports stay):
```ts
import type { FlowOptions } from '../model/flow-options';
import { emptyFlowModel, type FlowModel } from '../model/flow-model';
import { flowSchema } from '../model/flow-schema';
```

- [ ] **Step 7: Update the external `ui.css` path — `apps/tommy/host/project.json`**

In `targets.build…options.styles`, change:
```
"libs/tommy/multi-step-form/src/lib/ui.css"
```
to:
```
"libs/tommy/multi-step-form/src/lib/ui/ui.css"
```

- [ ] **Step 8: Sanity-check no stale imports remain**

```bash
# Should print NOTHING:
grep -rn "from '\./flow-\|from '\./error-banner'\|from '\./field-error'\|from '\./step-indicator'" libs/tommy/multi-step-form/src/lib/multi-step-flow.ts libs/tommy/multi-step-form/src/lib/multi-step-flow.spec.ts
grep -rn "from '\.\./flow-\|from '\.\./field-error'" libs/tommy/multi-step-form/src/lib/steps/
# Should print the OLD path NOWHERE:
grep -rn "src/lib/ui.css" apps/tommy/host/project.json
```
Expect all three greps to return no matches.

- [ ] **Step 9: Verify — tests, lint, AOT host build**

```bash
pnpm nx test tommy-multi-step-form
pnpm nx lint tommy-multi-step-form
pnpm nx build tommy-host
```
Expected: 31 tests pass; lint clean; host AOT build succeeds (this confirms the moved `ui.css` path and all rewired imports resolve under `strictTemplates`). If the build fails on a module-resolution error, a rewired import was missed — fix it and re-run.

- [ ] **Step 10: Commit**

```bash
git add libs/tommy/multi-step-form/src/lib apps/tommy/host/project.json
git commit -m "refactor(multi-step-form): group lib into model/ and ui/ subfolders"
```

---

## Self-review

**Spec coverage:**
- Moves table (model/ + ui/) → Step 1. ✓
- Import updates (container, container spec, 3 steps, steps spec) → Steps 2–6. ✓
- External `ui.css` path → Step 7. ✓
- "No per-folder barrels / index.ts unchanged" (non-goals) → respected (no such steps). ✓
- Verification (test + lint + AOT) → Steps 8–9. ✓

**Placeholder scan:** none — every edit shows the exact import lines.

**Path consistency:** new paths used consistently — `./model/*` and `./ui/*` from the container (depth `lib/` → `lib/model`), `../model/*` and `../ui/*` from `steps/` (depth `lib/steps/` → `lib/model`). Container `templateUrl`/`styleUrl` and `src/index.ts` deliberately untouched (container stays at lib root). ✓

**Notes:** `git mv` keeps history. The one easy-to-miss edit (host `project.json` `ui.css` path) is guarded by both Step 8's grep and Step 9's AOT build.
