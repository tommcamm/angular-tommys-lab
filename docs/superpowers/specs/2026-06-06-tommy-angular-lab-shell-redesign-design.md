# Tommy's Angular Lab: shell redesign

**Date:** 2026-06-06
**App:** `apps/tommy/host` (`tommy-host`)
**Status:** Approved (Direction A — refined clean/professional + dark mode)

## Problem

The deployed host is functional but barebone: a flat dark sidebar + light card
grid, fixed two-column layout that does not adapt to small screens, generic
"Tommy Labs" branding, no link back to the source repo, and a flat experiment
list with terse names ("Signal Forms", "Multi-Step Form"). It works, but it is
not something to proudly share with colleagues.

## Goal

Turn the host into a polished, responsive showcase — "Tommy's Angular Lab" — that
stays lean: a refined clean/professional light theme with a dark-mode toggle,
experiments grouped by category with friendlier names, a GitHub repo link, a
per-experiment "view source" link, tech badges, and a ⌘K command palette. All of
it derived, as today, from the single `EXPERIMENTS` registry.

## Non-goals

- No changes to the experiment libraries (`@tommy/signal-forms`,
  `@tommy/multi-step-form`) — their components and CSS stay untouched.
- No theming of experiment internals. Dark mode themes the **shell + landing**;
  each experiment renders on a forced-light "surface" (see Dark-mode scope).
- No new runtime dependencies. The command palette, theming, and icons are all
  hand-rolled (no UI kit, no icon package).
- No backend, no analytics, no routing/data-model changes beyond the registry.

## Design overview

Refined **Direction A** (clean/professional, light) as the default theme, plus an
opt-in dark theme. The dark grouped sidebar from the approved mockup is kept as a
constant anchor in **both** themes; the theme toggle flips the content area,
landing page, action bar, and cards. Layout:

- **Dark sidebar** (left, persistent ≥768px): brand → home, collapsible category
  groups of experiment nav links, a small footer (version · Angular 21).
- **Action bar** (top of content, sticky): ⌘K search trigger, theme toggle, and a
  GitHub **icon** link. On mobile it condenses to a hamburger + brand + icons.
- **Content**: the landing page (themed) or an experiment (light surface).
- **⌘K command palette**: a global overlay, registry-driven, keyboard-navigable.

Accessible contrast is a requirement in **both** themes; icon-only controls carry
`aria-label`s; transitions respect `prefers-reduced-motion`.

## Data model — `experiments.ts` (single source of truth)

Extend `Experiment` and add a grouping helper. The registry stays the only place
to edit when adding an experiment.

```ts
export const REPO_URL = 'https://github.com/tommcamm/angular-tommys-lab';

export interface Experiment {
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly group: string;              // category heading, e.g. 'Signal Forms'
  readonly tags: readonly string[];    // badge labels, e.g. ['signals','experimental']
  readonly sourcePath: string;         // repo-relative source dir for "view source"
  readonly load: ComponentLoader;
}

export interface ExperimentGroup {
  readonly name: string;
  readonly experiments: readonly Experiment[];
}

/** Group experiments by `group`, preserving first-seen order of groups and items. */
export function groupExperiments(
  experiments: readonly Experiment[],
): readonly ExperimentGroup[];

/** Full GitHub URL for an experiment's source folder. */
export function sourceUrl(e: Experiment): string; // `${REPO_URL}/tree/main/${e.sourcePath}`

/** tag -> badge color variant; neutral fallback for unknown tags. */
export const TAG_VARIANTS: Record<string, 'blue' | 'orange' | 'green' | 'neutral'>;
```

Updated entries:

| slug | title | group | tags | sourcePath |
| --- | --- | --- | --- | --- |
| `signal-forms` | **Simple Form** | Signal Forms | `signals`, `experimental` | `libs/tommy/signal-forms` |
| `multi-step-form` | **Wizard Form** | Signal Forms | `signals`, `multi-step` | `libs/tommy/multi-step-form` |

Slugs are unchanged (URLs stable). Only display `title`s change.

## Theming system

CSS custom properties (design tokens) in the **global** `styles.css` — not
component-scoped, so they are exempt from the 8kb per-component-style budget.

- `:root` holds the light token set (mirrors today's palette: `--bg #f6f8fa`,
  `--surface #fff`, `--border #d0d7de`, `--text #1f2328`, `--text-muted #57606a`,
  `--accent #1f6feb`, …).
- `[data-theme="dark"]` overrides the content/surface/text tokens for dark.
- **Sidebar tokens are constant in both themes** (the dark sidebar is the anchor),
  so only the content area, action bar, landing, and cards visibly flip.
- App/home/shell component CSS is rewritten to reference these tokens instead of
  hardcoded hex, so both themes fall out of one set of rules.

`ThemeService` (`shell/theme.service.ts`, `providedIn: 'root'`): a `signal<'light'
| 'dark'>` initialized from `localStorage` then `prefers-color-scheme`; an
`effect` writes `document.documentElement.dataset.theme` and persists to
`localStorage`; `toggle()` flips it. `localStorage`/`matchMedia` access is guarded
defensively.

**No FOUC:** a tiny inline script in `index.html <head>` sets
`document.documentElement.dataset.theme` from `localStorage`/`matchMedia` before
Angular boots, so the first paint is already in the right theme.

## Dark-mode scope — experiment surface

Experiment routes render inside a `.surface` panel (white, rounded, padded,
subtle border/shadow) that **re-declares the light token values locally**, so the
experiment and its chrome stay light regardless of the active theme. This honors
the non-goal (zero experiment-lib edits) and reads intentionally ("a document on
a desk") in dark mode.

The host distinguishes landing from experiment by URL: a `router.url`-derived
signal sets `isHome`; `<main>` gets the `.surface` class when `!isHome()`. (Home
is the only non-experiment route; `**` redirects to it.)

## Components (new, under `apps/tommy/host/src/app/shell/`)

Each is a small, focused standalone component:

- **`action-bar`** — sticky top bar. Inputs/outputs: emits `openSearch` and
  `toggleDrawer`; renders the ⌘K trigger, theme toggle (reads/writes
  `ThemeService`), and the GitHub icon link. Shows the hamburger only on mobile.
- **`side-nav`** — brand (→ home) + category groups built from
  `groupExperiments(EXPERIMENTS)`; each group heading is collapsible (local signal,
  default open); links use `routerLink` + `routerLinkActive`. Emits `navigate` so
  the mobile drawer can close on selection. Rendered in the desktop sidebar and
  inside the mobile drawer (same component).
- **`command-palette`** — global overlay opened via (meta|ctrl)+K (handled in
  `App` with `preventDefault`). A `query` signal filters experiments by
  title/tags/group; results are shown grouped; ↑/↓ move an `activeIndex`, ↵
  navigates via `Router` and closes, Esc/backdrop-click closes; the input is
  focused on open.
- **`github-icon`** — a tiny standalone component wrapping the inline GitHub mark
  SVG, reused by the action bar and the home "view source" links (the user asked
  for the icon, not the word "GitHub").

`App` becomes the orchestrator: CSS-grid layout, a `drawerOpen` signal, the global
⌘K key handler, and the `isHome`/surface logic. It composes `ActionBar`,
`SideNav` (desktop + drawer), `CommandPalette`, and `<router-outlet>`.

## Home (landing) changes

`home.html`/`.ts`/`.css`: render **grouped sections** (`groupExperiments`) — a
category heading followed by its card grid (one section today, scales later).
Each card gains: tech **badges** (`tags` → `TAG_VARIANTS` chip colors) and a
**"Source ↗"** link (`sourceUrl(e)`, opens in a new tab, `rel="noopener"`)
alongside the existing "Open →". Cards/grid use theme tokens.

## Responsive behavior

- **≥ 768px**: persistent dark sidebar + content column (action bar + main). Card
  grid auto-fills.
- **< 768px**: sidebar hidden; action bar shows a hamburger that toggles an
  off-canvas drawer (the same `side-nav`, fixed, `translateX` in/out, with a
  backdrop; closes on link tap, backdrop click, or Esc). Action-bar controls
  collapse to icons. Cards stack single-column. Touch targets ≥ 40px.

## File-by-file changes

**Modify**
- `apps/tommy/host/src/app/experiments.ts` — extend interface, add `REPO_URL`,
  `groupExperiments`, `sourceUrl`, `TAG_VARIANTS`; rename titles; add
  `group`/`tags`/`sourcePath` to both entries.
- `apps/tommy/host/src/app/app.ts` / `app.html` / `app.css` — new shell layout,
  drawer state, ⌘K handler, surface logic; compose the new shell components.
- `apps/tommy/host/src/app/app.routes.ts` — page titles use "Tommy's Angular Lab".
- `apps/tommy/host/src/app/home/home.ts` / `home.html` / `home.css` — grouped
  sections, badges, source links, token-based styles.
- `apps/tommy/host/src/styles.css` — token layer (`:root` + `[data-theme=dark]`),
  base `body` bg/text from tokens, `prefers-reduced-motion` guard.
- `apps/tommy/host/src/index.html` — `<title>` → "Tommy's Angular Lab"; inline
  no-FOUC theme-init script; `theme-color` meta.

**Create** (`apps/tommy/host/src/app/shell/`)
- `theme.service.ts` (+ `.spec.ts`)
- `action-bar.ts`
- `side-nav.ts` (+ `.spec.ts`)
- `command-palette.ts` (+ `.spec.ts`)
- `github-icon.ts`

## Verification

`pnpm nx test tommy-host && pnpm nx lint tommy-host && pnpm nx build tommy-host`

- **Unit (vitest):** `ThemeService` (init from storage/media, toggle persists +
  sets `dataset.theme`); `command-palette` (query filters, ↑↓/↵ navigate, Esc
  closes); `side-nav` (groups from registry, active link); `home` (grouped cards,
  badge variants, correct `sourceUrl` hrefs); `experiments` (`groupExperiments`
  order + `sourceUrl`); update `app.spec.ts`.
- **AOT/templates:** `pnpm nx build tommy-host` is the real `strictTemplates`
  check (the libs' `typecheck` is plain `tsc` and misses templates — per project
  memory). Must be green.
- **Manual:** resize across the 768px breakpoint (drawer ↔ sidebar); toggle theme
  and reload (persists, no flash); ⌘K opens/filters/navigates; GitHub icon →
  repo; card "Source ↗" → correct `libs/tommy/<name>` folder; both themes meet
  contrast.

## Risks / notes

- **Component-style budget** (`anyComponentStyle` error at 8kb): keep `app.css`
  and `home.css` lean; the bulk of theme rules lives in the global `styles.css`,
  which the budget does not cover.
- **Sidebar stays dark in both themes** by design — it is the visual anchor; only
  the content area flips. Intentional, matches the approved mockup.
- **No-FOUC script** must stay tiny and dependency-free and run before Angular
  boots; it is the one piece of logic duplicated outside `ThemeService`.
- **⌘K** calls `preventDefault` only when our handler fires, to avoid hijacking
  browser shortcuts otherwise.
- The forced-light `.surface` is the seam that keeps experiment libs untouched; if
  a future experiment is authored theme-aware, it can opt out later.
```
