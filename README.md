# Tommy's Angular Lab

[![CI](https://github.com/tommcamm/angular-tommys-lab/actions/workflows/ci.yml/badge.svg)](https://github.com/tommcamm/angular-tommys-lab/actions/workflows/ci.yml)

A personal Angular workspace for building focused experiments with new framework APIs and application patterns. Nx provides project boundaries, task orchestration, caching, and a single host application for browsing each experiment.

## Current Experiments

### Signal Forms

A standalone sign-up form built with Angular's experimental `@angular/forms/signals` API. It covers signal-backed models, validation, field state, and form submission.

### Multi-Step Form

A signup-style wizard that explores:

- backend-driven validation constraints
- reusable and composed schemas
- cross-field validation
- dynamic form arrays
- deferred validation messages
- server errors mapped back to fields
- one root form shared across presentational steps

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
pnpm exec nx test tommy-multi-step-form
pnpm exec nx build tommy-host
pnpm exec nx graph
```

## Repository Layout

```text
apps/
  tommy/host/                 Angular host and experiment navigation
libs/
  tommy/signal-forms/         Single-page signal forms experiment
  tommy/multi-step-form/      Multi-step signal forms experiment
docs/superpowers/             Design notes and implementation plans
```

The host derives its navigation and lazy routes from
`apps/tommy/host/src/app/experiments.ts`. Add a new experiment as an Nx library
under `libs/tommy`, export its entry component, add its TypeScript path alias,
and register one entry in `EXPERIMENTS`.

## CI

GitHub Actions installs the pinned pnpm version and runs `pnpm check` for pushes
to `main` and for pull requests.

## License

[MIT](LICENSE)
