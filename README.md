# Tommy's Angular Lab

[![CI](https://github.com/tommcamm/angular-tommys-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/tommcamm/angular-tommys-lab/actions/workflows/ci.yml)

A personal Angular workspace for building focused experiments with new framework APIs and application patterns. Nx provides project boundaries, task orchestration, caching, and a single host application for browsing each experiment.

## Current Experiments

| Experiment | Description |
| --- | --- |
| Simple Form | A standalone sign-up form covering signal-backed models, validation, field state, and submission. |
| Multi-Step Form | A signup wizard covering composed schemas, backend-driven constraints, dynamic arrays, deferred validation, and server errors. |
| Flow Forge | A composable engine for signal-forms multi-step flows: one skeleton powers many flows (minimal, complex fields, MitID signing). |

## Stack

- Angular 21
- Nx 22
- TypeScript 5.9
- Vitest
- Tailwind CSS 4
- pnpm 10

## Getting Started

Requirements:

- Node.js 22 or newer
- Corepack, included with standard Node.js installations

```bash
git clone git@github.com:tommcamm/angular-tommys-lab.git
cd angular-tommys-lab
corepack enable
pnpm install
pnpm start
```

The development server runs at `http://localhost:4200`.

## Commands

```bash
pnpm start       # Serve the experiment host
pnpm build       # Build all buildable projects
pnpm test        # Run all unit tests
pnpm lint        # Lint all projects
pnpm typecheck   # Type-check all projects
pnpm check       # Run the full local CI suite
```

Use Nx directly for project-specific tasks:

```bash
pnpm exec nx show projects
pnpm exec nx test tommy-signal-forms-multi-step-form
pnpm exec nx build tommy-host
pnpm exec nx graph
```

### Running the Flow Forge bank flow (MitID)

The Flow Forge bank experiment signs with MitID by redirecting to a mock provider
app. Serve **both** the host and the mock provider:

```bash
pnpm nx serve tommy-host        # http://localhost:4200
pnpm nx serve tommy-mock-idp    # http://localhost:4300  (MitID provider — needed for the bank flow)
```

The bank flow's MitID signing redirects to the `mock-idp` origin
(`http://localhost:4300`). In production it needs a deployed provider origin
(configured in `libs/tommy/signal-forms/flow-forge/src/lib/engine/mitid.ts` as
`MOCK_IDP_ORIGIN`) — absent one, the bank flow is dev-only.

## Repository Layout

```text
apps/
  tommy/host/                 Angular host and experiment navigation
  tommy/mock-idp/             Mock MitID provider for the Flow Forge bank flow
libs/
  tommy/signal-forms/
    simple-form/               Single-page signal forms experiment
    multi-step-form/           Multi-step signal forms experiment
    flow-forge/                Composable engine for multi-step flows
docs/superpowers/             Design notes and implementation plans
```

The host derives its navigation and lazy routes from
`apps/tommy/host/src/app/experiments/registry.ts`. Add a new experiment as an Nx
library under the relevant topic in `libs/tommy`, export its entry component,
add its TypeScript path alias, and register one entry in `EXPERIMENTS`.

## CI

GitHub Actions installs the pinned pnpm version and runs `pnpm check` for pushes
to `main` and for pull requests.

## License

[MIT](LICENSE)
