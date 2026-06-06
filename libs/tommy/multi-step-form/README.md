# tommy-multi-step-form

This library was generated with [Nx](https://nx.dev).

## Running unit tests

Run `pnpm nx test tommy-multi-step-form` to execute the unit tests.

## Styling

**Path taken: Tailwind v4 (plain-CSS `ui.css`, no spartan-ng components).**

### Packages installed
- `tailwindcss@4.3.0` (devDependency)
- `@tailwindcss/postcss@4.3.0` (devDependency)

### What was set up
- `.postcssrc.json` at the repo root activates `@tailwindcss/postcss` for the esbuild Angular builder.
- `apps/tommy/host/src/styles.css` imports only Tailwind's **theme tokens + utilities** (`tailwindcss/theme.css` + `tailwindcss/utilities.css`) and adds a `@source` directive pointing at this lib so template utilities are picked up. Tailwind's **preflight** (global reset) is intentionally omitted, because this host also renders the home page and the signal-forms experiment whose CSS was written against browser defaults — a global reset would alter their cascade.
- `libs/tommy/multi-step-form/src/lib/ui.css` is the single design-layer file: it defines all `.ui-*` semantic classes (plain CSS — no `@apply`). This file is registered in the host build's `styles` array so global styles reach lib components regardless of view encapsulation.

### Why not spartan-ng
`@spartan-ng/helm` does not exist on npm — spartan-ng distributes individual component packages (e.g. `@spartan-ng/ui-button-helm`). Since the `.ui-*` design layer is hand-authored CSS and no spartan-ng primitives are used in any component yet, there was no value in installing individual spartan-ng packages at this stage. They can be added per-component in later tasks if needed.

### Design decisions
- Components reference **only** `.ui-*` class names — no raw Tailwind utilities in templates.
- Swapping the styling engine (e.g. to `@apply`-based Tailwind or to a component library) requires only editing `ui.css`, not any component template.
