# Tommy's Angular Lab — Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers-extended-cc:subagent-driven-development (recommended) or superpowers-extended-cc:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `tommy-host` shell into a polished, responsive "Tommy's Angular Lab" — refined light theme + dark toggle, grouped/renamed experiments, GitHub icon link, per-experiment view-source, tech badges, and a ⌘K command palette — all derived from the `EXPERIMENTS` registry, with zero changes to the experiment libraries.

**Architecture:** The `EXPERIMENTS` registry stays the single source of truth and gains `group`/`tags`/`sourcePath` plus pure helpers. Theming is CSS custom properties (global `styles.css`) flipped by a `data-theme` attribute that a tiny `ThemeService` and a no-FOUC inline script set on `<html>`. The shell is composed of small standalone components under `app/shell/` (`GithubIcon`, `SideNav`, `ActionBar`, `CommandPalette`) orchestrated by `App` (CSS-grid layout, drawer signal, global ⌘K handler, light-surface wrapper for experiment routes). The dark sidebar is a constant anchor in both themes; experiments render on a forced-light surface so their existing CSS is untouched.

**Tech Stack:** Angular 21.2 (standalone, signals, `@angular/forms/signals` unaffected), Nx 22.7, Vite + Vitest (`@analogjs/vitest-angular`, jsdom), Tailwind v4 (tokens/utilities only — no preflight).

---

## File Structure

**Modify**
- `apps/tommy/host/src/app/experiments.ts` — extend `Experiment`, add `REPO_URL`, `ExperimentGroup`, `groupExperiments()`, `sourceUrl()`, `TAG_VARIANTS`/`tagVariant()`; rename titles; add metadata to both entries.
- `apps/tommy/host/src/styles.css` — design-token layer (`:root` light, `:root[data-theme='dark']`), base `body`, reduced-motion guard.
- `apps/tommy/host/src/index.html` — `<title>`, no-FOUC theme script, `theme-color` meta.
- `apps/tommy/host/src/app/app.ts` / `app.html` / `app.css` — shell layout, drawer, ⌘K handler, surface logic.
- `apps/tommy/host/src/app/app.routes.ts` — page titles.
- `apps/tommy/host/src/app/app.spec.ts` — updated for grouped nav + palette.
- `apps/tommy/host/src/app/home/home.ts` / `home.html` / `home.css` — grouped sections, badges, source links.

**Create** (`apps/tommy/host/src/app/shell/`)
- `theme.service.ts` (+ `theme.service.spec.ts`)
- `github-icon.ts`
- `side-nav.ts` (+ `side-nav.spec.ts`)
- `action-bar.ts`
- `command-palette.ts` (+ `command-palette.spec.ts`)

**Test commands**
- Unit: `pnpm nx test tommy-host`
- Lint: `pnpm nx lint tommy-host`
- AOT/templates (the real `strictTemplates` check): `pnpm nx build tommy-host`

---

### Task 1: Extend the experiments registry

**Goal:** Make `experiments.ts` carry grouping/tags/source metadata and expose pure helpers, with renamed titles.

**Files:**
- Modify: `apps/tommy/host/src/app/experiments.ts`
- Test: `apps/tommy/host/src/app/experiments.spec.ts` (create)

**Acceptance Criteria:**
- [ ] `Experiment` has `group`, `tags`, `sourcePath`; both entries are renamed (`Simple Form`, `Wizard Form`) and grouped under `Signal Forms`.
- [ ] `groupExperiments()` groups by `group`, preserving first-seen order of groups and items.
- [ ] `sourceUrl(e)` returns `${REPO_URL}/tree/main/${e.sourcePath}`.
- [ ] `tagVariant(tag)` maps known tags to a variant and falls back to `'neutral'`.
- [ ] Slugs are unchanged (`signal-forms`, `multi-step-form`).

**Verify:** `pnpm nx test tommy-host` → `experiments` suite passes.

**Steps:**

- [ ] **Step 1: Write the failing test** — `apps/tommy/host/src/app/experiments.spec.ts`

```ts
import {
  EXPERIMENTS,
  REPO_URL,
  groupExperiments,
  sourceUrl,
  tagVariant,
} from './experiments';

describe('experiments registry', () => {
  it('renames and regroups both form experiments', () => {
    const bySlug = Object.fromEntries(EXPERIMENTS.map((e) => [e.slug, e]));
    expect(bySlug['signal-forms'].title).toBe('Simple Form');
    expect(bySlug['multi-step-form'].title).toBe('Wizard Form');
    expect(bySlug['signal-forms'].group).toBe('Signal Forms');
    expect(bySlug['multi-step-form'].group).toBe('Signal Forms');
  });

  it('groups experiments by group, preserving order', () => {
    const groups = groupExperiments();
    expect(groups.map((g) => g.name)).toEqual(['Signal Forms']);
    expect(groups[0].experiments.map((e) => e.slug)).toEqual([
      'signal-forms',
      'multi-step-form',
    ]);
  });

  it('builds a GitHub source URL', () => {
    expect(sourceUrl(EXPERIMENTS[0])).toBe(
      `${REPO_URL}/tree/main/libs/tommy/signal-forms`,
    );
  });

  it('maps tags to badge variants with a neutral fallback', () => {
    expect(tagVariant('signals')).toBe('blue');
    expect(tagVariant('multi-step')).toBe('green');
    expect(tagVariant('totally-unknown')).toBe('neutral');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-host`
Expected: FAIL — `groupExperiments`/`sourceUrl`/`tagVariant` not exported; titles still old.

- [ ] **Step 3: Rewrite `apps/tommy/host/src/app/experiments.ts`**

```ts
import type { Route } from '@angular/router';

/** A lazily-loaded standalone component, as accepted by `Route.loadComponent`. */
type ComponentLoader = NonNullable<Route['loadComponent']>;

/** GitHub repository the lab lives in. */
export const REPO_URL = 'https://github.com/tommcamm/angular-tommys-lab';

/** Badge color variants for experiment tags. */
export type TagVariant = 'blue' | 'orange' | 'green' | 'neutral';

const TAG_VARIANTS: Record<string, TagVariant> = {
  signals: 'blue',
  experimental: 'orange',
  'multi-step': 'green',
};

/** Variant for a tag chip; unknown tags render neutral. */
export function tagVariant(tag: string): TagVariant {
  return TAG_VARIANTS[tag] ?? 'neutral';
}

/**
 * One pluggable experiment in the host — the single source of truth. The sidebar,
 * the landing-page cards, the command palette, and the router config are all
 * derived from {@link EXPERIMENTS}. To add an experiment, create its `@tommy/*`
 * library and append one entry below.
 */
export interface Experiment {
  /** URL slug, e.g. `'signal-forms'` → `/signal-forms`. Must be unique. */
  readonly slug: string;
  /** Display name shown in the nav, cards, and palette. */
  readonly title: string;
  /** One-line summary shown on the landing card. */
  readonly description: string;
  /** Category heading this experiment groups under, e.g. `'Signal Forms'`. */
  readonly group: string;
  /** Short badge labels, e.g. `['signals', 'experimental']`. */
  readonly tags: readonly string[];
  /** Repo-relative path to the experiment's source folder (for "view source"). */
  readonly sourcePath: string;
  /** Lazy loader for the experiment's entry component (own JS chunk). */
  readonly load: ComponentLoader;
}

/** A named category with its experiments, as produced by {@link groupExperiments}. */
export interface ExperimentGroup {
  readonly name: string;
  readonly experiments: readonly Experiment[];
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    slug: 'signal-forms',
    title: 'Simple Form',
    description:
      'A sign-up form built on the experimental @angular/forms/signals API.',
    group: 'Signal Forms',
    tags: ['signals', 'experimental'],
    sourcePath: 'libs/tommy/signal-forms',
    load: () => import('@tommy/signal-forms').then((m) => m.TommySignalForms),
  },
  {
    slug: 'multi-step-form',
    title: 'Wizard Form',
    description:
      'A multi-step signup wizard on @angular/forms/signals: backend-driven constraints, composed schemas, and a server-error submit.',
    group: 'Signal Forms',
    tags: ['signals', 'multi-step'],
    sourcePath: 'libs/tommy/multi-step-form',
    load: () => import('@tommy/multi-step-form').then((m) => m.MultiStepFlow),
  },
];

/** Group experiments by `group`, preserving first-seen order of groups and items. */
export function groupExperiments(
  experiments: readonly Experiment[] = EXPERIMENTS,
): readonly ExperimentGroup[] {
  const order: string[] = [];
  const byGroup = new Map<string, Experiment[]>();
  for (const e of experiments) {
    const bucket = byGroup.get(e.group);
    if (bucket) {
      bucket.push(e);
    } else {
      byGroup.set(e.group, [e]);
      order.push(e.group);
    }
  }
  return order.map((name) => ({ name, experiments: byGroup.get(name)! }));
}

/** Full GitHub URL for an experiment's source folder. */
export function sourceUrl(e: Experiment): string {
  return `${REPO_URL}/tree/main/${e.sourcePath}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test tommy-host`
Expected: PASS — `experiments` suite green. (The existing `app.spec.ts` may transiently fail later tasks; it is updated in Task 6.)

- [ ] **Step 5: Commit**

```bash
git add apps/tommy/host/src/app/experiments.ts apps/tommy/host/src/app/experiments.spec.ts
git commit -m "feat(host): grouped/tagged experiment registry with source helpers"
```

---

### Task 2: Theming — tokens, ThemeService, no-FOUC bootstrap

**Goal:** A `data-theme`-driven design-token system with a tiny service and a flash-free initial paint; brand title set.

**Files:**
- Modify: `apps/tommy/host/src/styles.css`
- Modify: `apps/tommy/host/src/index.html`
- Create: `apps/tommy/host/src/app/shell/theme.service.ts`
- Test: `apps/tommy/host/src/app/shell/theme.service.spec.ts`

**Acceptance Criteria:**
- [ ] `styles.css` defines a light token set on `:root` and a dark override on `:root[data-theme='dark']`, plus `body` colors from tokens and a `prefers-reduced-motion` guard.
- [ ] `ThemeService` initializes from `localStorage` then `prefers-color-scheme`, defaulting to `light`; `toggle()`/`set()` update the signal, write `document.documentElement.dataset.theme`, and persist. `matchMedia`/`localStorage` access is guarded.
- [ ] `index.html` sets `<title>Tommy's Angular Lab</title>`, a `theme-color` meta, and an inline script that applies the stored/preferred theme before Angular boots.

**Verify:** `pnpm nx test tommy-host` → `ThemeService` suite passes.

**Steps:**

- [ ] **Step 1: Write the failing test** — `apps/tommy/host/src/app/shell/theme.service.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light when nothing is stored', () => {
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });

  it('reads a stored theme', () => {
    localStorage.setItem('tommy-lab-theme', 'dark');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('toggle flips the theme, writes data-theme, and persists', () => {
    const svc = TestBed.inject(ThemeService);
    svc.toggle();
    expect(svc.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('tommy-lab-theme')).toBe('dark');
    svc.toggle();
    expect(svc.theme()).toBe('light');
    expect(localStorage.getItem('tommy-lab-theme')).toBe('light');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-host`
Expected: FAIL — `./theme.service` does not exist.

- [ ] **Step 3: Create `apps/tommy/host/src/app/shell/theme.service.ts`**

```ts
import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tommy-lab-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
}

function initialTheme(): Theme {
  return readStored() ?? (prefersDark() ? 'dark' : 'light');
}

/**
 * Holds the active theme as a signal and mirrors it to `<html data-theme>` +
 * `localStorage`. Applied imperatively (not via `effect`) so DOM/storage writes
 * are synchronous and trivially testable. The token CSS in `styles.css` does the
 * rest. A matching inline script in `index.html` prevents a first-paint flash.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(initialTheme());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'light' ? 'dark' : 'light');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Non-fatal: storage may be unavailable (private mode/quota). The
      // in-memory signal + data-theme attribute still drive the UI.
      void e;
    }
  }
}
```

- [ ] **Step 4: Append the token layer to `apps/tommy/host/src/styles.css`** (after the existing `@source` line)

```css
/* ---- Design tokens ------------------------------------------------------ */
:root {
  color-scheme: light;
  --bg: #f6f8fa;
  --surface: #ffffff;
  --surface-2: #f6f8fa;
  --border: #d0d7de;
  --text: #1f2328;
  --text-muted: #57606a;
  --accent: #1f6feb;
  --accent-fg: #ffffff;
  --accent-soft: #ddf4ff;
  --shadow: 0 6px 18px rgba(31, 111, 235, 0.12);

  /* Sidebar — constant in both themes (the dark anchor). */
  --sidebar-bg: #0d1117;
  --sidebar-text: #c9d1d9;
  --sidebar-text-strong: #e6edf3;
  --sidebar-muted: #8b949e;
  --sidebar-hover: #161b22;
  --sidebar-active-bg: #1f6feb;
  --sidebar-active-fg: #ffffff;
  --sidebar-border: #21262d;

  /* Tag badges. */
  --badge-blue-bg: #ddf4ff;   --badge-blue-fg: #0969da;
  --badge-orange-bg: #fff1e5; --badge-orange-fg: #bc4c00;
  --badge-green-bg: #dafbe1;  --badge-green-fg: #1a7f37;
  --badge-neutral-bg: #eaeef2;--badge-neutral-fg: #57606a;
}

:root[data-theme='dark'] {
  color-scheme: dark;
  --bg: #0d1117;
  --surface: #161b22;
  --surface-2: #0d1117;
  --border: #30363d;
  --text: #e6edf3;
  --text-muted: #8b949e;
  --accent: #4493f8;
  --accent-fg: #ffffff;
  --accent-soft: #11304e;
  --shadow: 0 8px 24px rgba(1, 4, 9, 0.5);

  --badge-blue-bg: #11304e;   --badge-blue-fg: #79c0ff;
  --badge-orange-bg: #3a2008; --badge-orange-fg: #f0883e;
  --badge-green-bg: #102d18;  --badge-green-fg: #56d364;
  --badge-neutral-bg: #21262d;--badge-neutral-fg: #8b949e;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--text);
  font-family: system-ui, sans-serif;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    transition-duration: 0.01ms !important;
    animation-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 5: Update `apps/tommy/host/src/index.html`** — replace `<title>`, add a `theme-color` meta, and an inline no-FOUC script in `<head>`

```html
    <title>Tommy's Angular Lab</title>
    <meta name="theme-color" content="#0d1117" />
    <script>
      (function () {
        try {
          var k = 'tommy-lab-theme';
          var t = localStorage.getItem(k);
          if (t !== 'light' && t !== 'dark') {
            t =
              window.matchMedia &&
              window.matchMedia('(prefers-color-scheme: dark)').matches
                ? 'dark'
                : 'light';
          }
          document.documentElement.dataset.theme = t;
        } catch (e) {
          /* keep default light */
        }
      })();
    </script>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm nx test tommy-host`
Expected: PASS — `ThemeService` suite green.

- [ ] **Step 7: Commit**

```bash
git add apps/tommy/host/src/styles.css apps/tommy/host/src/index.html apps/tommy/host/src/app/shell/theme.service.ts apps/tommy/host/src/app/shell/theme.service.spec.ts
git commit -m "feat(host): theme tokens + ThemeService + no-flash bootstrap"
```

---

### Task 3: GitHub icon component

**Goal:** A reusable inline-SVG GitHub mark (used by the action bar, sidebar, and source links — the user asked for the icon, not the word).

**Files:**
- Create: `apps/tommy/host/src/app/shell/github-icon.ts`

**Acceptance Criteria:**
- [ ] `tommy-github-icon` renders an inline `<svg>` using `fill="currentColor"` with `aria-hidden="true"`, sized via `:host`.
- [ ] Standalone, `OnPush`, no inputs.

**Verify:** `pnpm nx build tommy-host` compiles the component (covered by later tasks that import it).

**Steps:**

- [ ] **Step 1: Create `apps/tommy/host/src/app/shell/github-icon.ts`**

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';

/** GitHub "mark" logo as inline SVG; inherits color via `currentColor`. */
@Component({
  selector: 'tommy-github-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <svg viewBox="0 0 16 16" width="100%" height="100%" fill="currentColor" aria-hidden="true">
      <path
        d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"
      />
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.25rem;
      height: 1.25rem;
      line-height: 0;
    }
  `,
})
export class GithubIcon {}
```

- [ ] **Step 2: Commit**

```bash
git add apps/tommy/host/src/app/shell/github-icon.ts
git commit -m "feat(host): GithubIcon component"
```

---

### Task 4: SideNav component (grouped, collapsible)

**Goal:** Brand + collapsible category groups of experiment links + a GitHub source link, emitting `navigate` so the mobile drawer can close.

**Files:**
- Create: `apps/tommy/host/src/app/shell/side-nav.ts`
- Test: `apps/tommy/host/src/app/shell/side-nav.spec.ts`

**Acceptance Criteria:**
- [ ] Renders one `.group-heading` per group and one `.nav-link` per experiment, built from `groupExperiments()`.
- [ ] Each group is collapsible (default open); collapsing hides its `.nav-link`s.
- [ ] Clicking the brand or a nav link emits `navigate`.
- [ ] Renders a GitHub repo link using `tommy-github-icon` and `REPO_URL`.

**Verify:** `pnpm nx test tommy-host` → `SideNav` suite passes.

**Steps:**

- [ ] **Step 1: Write the failing test** — `apps/tommy/host/src/app/shell/side-nav.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SideNav } from './side-nav';
import { EXPERIMENTS, groupExperiments } from '../experiments';

describe('SideNav', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideNav],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders a heading per group and a link per experiment', () => {
    const f = TestBed.createComponent(SideNav);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.group-heading').length).toBe(
      groupExperiments().length,
    );
    expect(el.querySelectorAll('.nav-link').length).toBe(EXPERIMENTS.length);
    expect(el.querySelector('.nav-link')?.textContent?.trim()).toBe(
      EXPERIMENTS[0].title,
    );
  });

  it('collapses a group when its heading is clicked', () => {
    const f = TestBed.createComponent(SideNav);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.group-heading')!.click();
    f.detectChanges();
    expect(el.querySelectorAll('.nav-link').length).toBe(0);
  });

  it('emits navigate when a link is clicked', () => {
    const f = TestBed.createComponent(SideNav);
    f.detectChanges();
    const spy = vi.fn();
    f.componentInstance.navigate.subscribe(spy);
    f.nativeElement.querySelector<HTMLAnchorElement>('.nav-link')!.click();
    expect(spy).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-host`
Expected: FAIL — `./side-nav` does not exist.

- [ ] **Step 3: Create `apps/tommy/host/src/app/shell/side-nav.ts`**

```ts
import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { REPO_URL, groupExperiments } from '../experiments';
import { GithubIcon } from './github-icon';

/** Brand + collapsible grouped experiment nav. Rendered in the desktop sidebar
 *  and inside the mobile drawer; emits `navigate` so the drawer can close. */
@Component({
  selector: 'tommy-side-nav',
  imports: [RouterLink, RouterLinkActive, GithubIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brand" routerLink="/" (click)="navigate.emit()">
      🧪 Tommy's Angular Lab
    </a>

    <nav>
      @for (group of groups; track group.name) {
        <div class="group">
          <button
            type="button"
            class="group-heading"
            [attr.aria-expanded]="isOpen(group.name)"
            (click)="toggleGroup(group.name)"
          >
            <span class="caret" [class.open]="isOpen(group.name)">▸</span>
            {{ group.name }}
          </button>
          @if (isOpen(group.name)) {
            <div class="group-items">
              @for (exp of group.experiments; track exp.slug) {
                <a
                  class="nav-link"
                  [routerLink]="exp.slug"
                  routerLinkActive="active"
                  (click)="navigate.emit()"
                >
                  {{ exp.title }}
                </a>
              }
            </div>
          }
        </div>
      } @empty {
        <p class="nav-empty">None yet</p>
      }
    </nav>

    <a
      class="repo-link"
      [href]="repoUrl"
      target="_blank"
      rel="noopener"
      aria-label="View this project on GitHub"
    >
      <tommy-github-icon />
      <span>Source on GitHub</span>
    </a>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      height: 100%;
      padding: 1.5rem 1rem;
      color: var(--sidebar-text);
    }
    .brand {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--sidebar-text-strong);
      text-decoration: none;
    }
    nav { display: flex; flex-direction: column; gap: 0.75rem; }
    .group-heading {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.25rem 0.5rem;
      background: none;
      border: 0;
      color: var(--sidebar-muted);
      font: inherit;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .caret { transition: transform 0.15s; }
    .caret.open { transform: rotate(90deg); }
    .group-items { display: flex; flex-direction: column; gap: 0.125rem; }
    .nav-link {
      padding: 0.5rem 0.625rem;
      border-radius: 0.5rem;
      color: var(--sidebar-text);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .nav-link:hover { background: var(--sidebar-hover); color: #fff; }
    .nav-link.active {
      background: var(--sidebar-active-bg);
      color: var(--sidebar-active-fg);
    }
    .nav-empty { padding: 0 0.625rem; color: var(--sidebar-muted); font-size: 0.85rem; }
    .repo-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--sidebar-border);
      color: var(--sidebar-muted);
      text-decoration: none;
      font-size: 0.85rem;
    }
    .repo-link:hover { color: #fff; }
  `,
})
export class SideNav {
  /** Emitted on brand/link click so a parent drawer can close itself. */
  readonly navigate = output<void>();

  protected readonly groups = groupExperiments();
  protected readonly repoUrl = REPO_URL;

  /** Set of collapsed group names (absent ⇒ open). */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());

  protected isOpen(group: string): boolean {
    return !this.collapsed().has(group);
  }

  protected toggleGroup(group: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test tommy-host`
Expected: PASS — `SideNav` suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/tommy/host/src/app/shell/side-nav.ts apps/tommy/host/src/app/shell/side-nav.spec.ts
git commit -m "feat(host): grouped collapsible SideNav"
```

---

### Task 5: Command palette (⌘K)

**Goal:** A registry-driven overlay that filters experiments, supports keyboard navigation, and routes on selection.

**Files:**
- Create: `apps/tommy/host/src/app/shell/command-palette.ts`
- Test: `apps/tommy/host/src/app/shell/command-palette.spec.ts`

**Acceptance Criteria:**
- [ ] `openPalette()` shows the overlay and resets the query; `close()` hides it; `toggle()` flips it; `open()` exposes state.
- [ ] Results filter by title/group/tag (case-insensitive); empty query shows all groups.
- [ ] ArrowDown/ArrowUp move the active item (clamped); Enter routes to the active experiment and closes; Escape closes.
- [ ] Selecting (click or Enter) calls `Router.navigate([slug])`.

**Verify:** `pnpm nx test tommy-host` → `CommandPalette` suite passes.

**Steps:**

- [ ] **Step 1: Write the failing test** — `apps/tommy/host/src/app/shell/command-palette.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CommandPalette } from './command-palette';

describe('CommandPalette', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommandPalette],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function make() {
    const f = TestBed.createComponent(CommandPalette);
    f.detectChanges();
    return f;
  }

  it('is closed initially and opens/closes', () => {
    const f = make();
    expect(f.componentInstance.open()).toBe(false);
    f.componentInstance.openPalette();
    expect(f.componentInstance.open()).toBe(true);
    f.componentInstance.close();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('filters experiments by query (title/tag/group)', () => {
    const f = make();
    const c = f.componentInstance as unknown as {
      query: { set: (v: string) => void };
      results: () => { experiments: { slug: string }[] }[];
    };
    c.query.set('wizard');
    const slugs = c.results().flatMap((g) => g.experiments.map((e) => e.slug));
    expect(slugs).toEqual(['multi-step-form']);

    c.query.set('multi'); // matches the 'multi-step' tag
    expect(
      c.results().flatMap((g) => g.experiments.map((e) => e.slug)),
    ).toEqual(['multi-step-form']);
  });

  it('Enter routes to the active experiment and closes', () => {
    const f = make();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const c = f.componentInstance as unknown as {
      query: { set: (v: string) => void };
      onKeydown: (e: KeyboardEvent) => void;
    };
    f.componentInstance.openPalette();
    c.query.set('wizard');
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navSpy).toHaveBeenCalledWith(['multi-step-form']);
    expect(f.componentInstance.open()).toBe(false);
  });

  it('Escape closes', () => {
    const f = make();
    f.componentInstance.openPalette();
    (
      f.componentInstance as unknown as { onKeydown: (e: KeyboardEvent) => void }
    ).onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(f.componentInstance.open()).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-host`
Expected: FAIL — `./command-palette` does not exist.

- [ ] **Step 3: Create `apps/tommy/host/src/app/shell/command-palette.ts`**

```ts
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { type Experiment, groupExperiments } from '../experiments';

/** ⌘K overlay: registry-driven, keyboard-navigable experiment switcher. The
 *  global shortcut is owned by `App`, which calls `toggle()`/`openPalette()`. */
@Component({
  selector: 'tommy-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <div class="backdrop" (click)="close()"></div>
      <div class="palette" role="dialog" aria-modal="true" aria-label="Search experiments">
        <input
          #search
          class="palette-input"
          type="text"
          placeholder="Search experiments…"
          [value]="query()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
        />
        <div class="results">
          @for (group of results(); track group.name) {
            <p class="result-heading">{{ group.name }}</p>
            @for (exp of group.experiments; track exp.slug) {
              <button
                type="button"
                class="result"
                [class.active]="exp.slug === activeSlug()"
                (mouseenter)="setActive(exp.slug)"
                (click)="choose(exp)"
              >
                <span>{{ exp.title }}</span>
                <span class="hint">↵</span>
              </button>
            }
          } @empty {
            <p class="empty">No experiments match “{{ query() }}”.</p>
          }
        </div>
        <div class="footer">↑↓ navigate · ↵ open · esc close</div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      background: rgba(1, 4, 9, 0.55);
      z-index: 40;
    }
    .palette {
      position: fixed;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(34rem, calc(100vw - 2rem));
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      box-shadow: 0 24px 60px rgba(1, 4, 9, 0.45);
      overflow: hidden;
      z-index: 41;
    }
    .palette-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.9rem 1rem;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 1rem;
      outline: none;
    }
    .results { max-height: 50vh; overflow: auto; padding: 0.375rem; }
    .result-heading {
      margin: 0.375rem 0.25rem 0.125rem;
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .result {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0.6rem 0.7rem;
      border: 0;
      border-radius: 0.5rem;
      background: none;
      color: var(--text);
      font: inherit;
      font-size: 0.9rem;
      text-align: left;
      cursor: pointer;
    }
    .result.active { background: var(--accent-soft); color: var(--accent); }
    .result .hint { font-size: 0.75rem; color: var(--text-muted); }
    .empty { padding: 1rem; color: var(--text-muted); }
    .footer {
      border-top: 1px solid var(--border);
      padding: 0.5rem 0.8rem;
      font-size: 0.7rem;
      color: var(--text-muted);
    }
  `,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly searchInput =
    viewChild<ElementRef<HTMLInputElement>>('search');

  readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const groups = groupExperiments();
    if (!q) return groups;
    return groups
      .map((g) => ({
        name: g.name,
        experiments: g.experiments.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.group.toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.experiments.length > 0);
  });

  private readonly flat = computed(() =>
    this.results().flatMap((g) => [...g.experiments]),
  );

  protected readonly activeSlug = computed(() => {
    const items = this.flat();
    if (items.length === 0) return null;
    return items[Math.min(this.activeIndex(), items.length - 1)].slug;
  });

  openPalette(): void {
    this.query.set('');
    this.activeIndex.set(0);
    this.open.set(true);
    queueMicrotask(() => this.searchInput()?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openPalette();
    }
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected setActive(slug: string): void {
    const idx = this.flat().findIndex((e) => e.slug === slug);
    if (idx >= 0) this.activeIndex.set(idx);
  }

  protected choose(exp: Experiment): void {
    this.close();
    this.router.navigate([exp.slug]);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const items = this.flat();
    switch (e.key) {
      case 'Escape':
        this.close();
        return;
      case 'ArrowDown':
        if (items.length) {
          e.preventDefault();
          this.activeIndex.update((i) => Math.min(i + 1, items.length - 1));
        }
        return;
      case 'ArrowUp':
        if (items.length) {
          e.preventDefault();
          this.activeIndex.update((i) => Math.max(i - 1, 0));
        }
        return;
      case 'Enter': {
        e.preventDefault();
        const sel = items[Math.min(this.activeIndex(), items.length - 1)];
        if (sel) this.choose(sel);
        return;
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm nx test tommy-host`
Expected: PASS — `CommandPalette` suite green.

- [ ] **Step 5: Commit**

```bash
git add apps/tommy/host/src/app/shell/command-palette.ts apps/tommy/host/src/app/shell/command-palette.spec.ts
git commit -m "feat(host): ⌘K command palette"
```

---

### Task 6: App shell — ActionBar + layout, drawer, ⌘K, light surface

**Goal:** Assemble the shell: a sticky action bar (search/theme/GitHub/hamburger), the responsive grid with a mobile drawer, the global ⌘K handler, and the forced-light surface for experiment routes.

**Files:**
- Create: `apps/tommy/host/src/app/shell/action-bar.ts`
- Modify: `apps/tommy/host/src/app/app.ts`
- Modify: `apps/tommy/host/src/app/app.html`
- Modify: `apps/tommy/host/src/app/app.css`
- Modify: `apps/tommy/host/src/app/app.routes.ts`
- Modify: `apps/tommy/host/src/app/app.spec.ts`

**Acceptance Criteria:**
- [ ] `ActionBar` shows a ⌘K search trigger, a theme toggle wired to `ThemeService`, a GitHub icon link, and a hamburger (mobile only); emits `openSearch` and `toggleDrawer`.
- [ ] `App` lays out sidebar + content via CSS grid; below 768px the sidebar becomes an off-canvas drawer with a backdrop, toggled by the hamburger and closed on nav.
- [ ] Ctrl/Cmd+K toggles the palette globally (with `preventDefault`).
- [ ] Experiment routes (anything but `/`) render inside a `.surface-host` that pins light tokens; the landing page does not.
- [ ] Route titles read `… · Tommy's Angular Lab`; `app.spec.ts` passes.

**Verify:** `pnpm nx test tommy-host` (App suite) and `pnpm nx build tommy-host` both green.

**Steps:**

- [ ] **Step 1: Create `apps/tommy/host/src/app/shell/action-bar.ts`**

```ts
import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { REPO_URL } from '../experiments';
import { GithubIcon } from './github-icon';
import { ThemeService } from './theme.service';

/** Sticky top bar: hamburger (mobile), ⌘K search trigger, theme toggle, GitHub. */
@Component({
  selector: 'tommy-action-bar',
  imports: [GithubIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="hamburger"
      aria-label="Open navigation"
      (click)="toggleDrawer.emit()"
    >
      ☰
    </button>

    <button type="button" class="search" (click)="openSearch.emit()">
      <span aria-hidden="true">🔍</span>
      <span class="search-label">Search experiments…</span>
      <kbd>⌘K</kbd>
    </button>

    <span class="spacer"></span>

    <button
      type="button"
      class="icon-btn"
      [attr.aria-label]="
        theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      "
      (click)="theme.toggle()"
    >
      {{ theme.theme() === 'dark' ? '☀' : '☾' }}
    </button>

    <a
      class="icon-btn"
      [href]="repoUrl"
      target="_blank"
      rel="noopener"
      aria-label="View this project on GitHub"
    >
      <tommy-github-icon />
    </a>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .spacer { flex: 1; }
    .hamburger {
      display: none;
      background: none;
      border: 0;
      color: var(--text);
      font-size: 1.25rem;
      cursor: pointer;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      max-width: 22rem;
      flex: 1;
      padding: 0.45rem 0.7rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text-muted);
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .search-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .search kbd {
      margin-left: auto;
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--border);
      border-radius: 0.25rem;
      background: var(--surface);
      font-size: 0.75rem;
    }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 0;
      border-radius: 0.5rem;
      background: none;
      color: var(--text-muted);
      font-size: 1.05rem;
      text-decoration: none;
      cursor: pointer;
    }
    .icon-btn:hover { background: var(--surface-2); color: var(--text); }
    @media (max-width: 768px) {
      .hamburger { display: inline-flex; }
      .search { max-width: none; }
      .search-label,
      .search kbd { display: none; }
    }
  `,
})
export class ActionBar {
  protected readonly theme = inject(ThemeService);
  protected readonly repoUrl = REPO_URL;
  readonly openSearch = output<void>();
  readonly toggleDrawer = output<void>();
}
```

- [ ] **Step 2: Rewrite `apps/tommy/host/src/app/app.ts`**

```ts
import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ActionBar } from './shell/action-bar';
import { CommandPalette } from './shell/command-palette';
import { SideNav } from './shell/side-nav';

@Component({
  selector: 'tommy-root',
  imports: [RouterOutlet, SideNav, ActionBar, CommandPalette],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly palette = viewChild.required(CommandPalette);

  protected readonly drawerOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The landing page is the only non-experiment route. */
  protected readonly isHome = computed(() => {
    const u = this.url();
    return u === '/' || u === '';
  });

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
  }

  protected openSearch(): void {
    this.palette().openPalette();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette().toggle();
    }
  }
}
```

- [ ] **Step 3: Rewrite `apps/tommy/host/src/app/app.html`**

```html
<div class="layout" [class.drawer-open]="drawerOpen()">
  <aside class="sidebar">
    <tommy-side-nav (navigate)="closeDrawer()" />
  </aside>

  @if (drawerOpen()) {
    <div class="backdrop" (click)="closeDrawer()"></div>
  }

  <div class="content">
    <tommy-action-bar
      (openSearch)="openSearch()"
      (toggleDrawer)="toggleDrawer()"
    />
    <main class="main" [class.surface-host]="!isHome()">
      <router-outlet />
    </main>
  </div>
</div>

<tommy-command-palette />
```

- [ ] **Step 4: Rewrite `apps/tommy/host/src/app/app.css`**

```css
:host {
  display: block;
  min-height: 100vh;
  color: var(--text);
}

.layout {
  display: grid;
  grid-template-columns: 16rem 1fr;
  min-height: 100vh;
}

.sidebar {
  position: sticky;
  top: 0;
  height: 100vh;
  overflow: auto;
  background: var(--sidebar-bg);
}

.content {
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: var(--bg);
}

.main {
  flex: 1;
  padding: 2.5rem;
  overflow: auto;
}

/* Experiment routes: a forced-light "surface" so each experiment's own
   light-background CSS keeps working unchanged in either theme. */
.main.surface-host {
  --bg: #f6f8fa;
  --surface: #ffffff;
  --surface-2: #f6f8fa;
  --border: #d0d7de;
  --text: #1f2328;
  --text-muted: #57606a;
  --accent: #1f6feb;
  margin: 1.5rem;
  padding: 2rem;
  background: #ffffff;
  color: #1f2328;
  border: 1px solid #d0d7de;
  border-radius: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

.backdrop { display: none; }

@media (max-width: 768px) {
  .layout { grid-template-columns: 1fr; }

  .sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    width: 16rem;
    height: auto;
    z-index: 30;
    transform: translateX(-100%);
    transition: transform 0.2s ease;
  }
  .layout.drawer-open .sidebar { transform: translateX(0); }

  .backdrop {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 20;
    background: rgba(1, 4, 9, 0.45);
  }

  .main { padding: 1rem; }
  .main.surface-host { margin: 0.75rem; padding: 1.25rem; }
}
```

- [ ] **Step 5: Update `apps/tommy/host/src/app/app.routes.ts`**

```ts
import { Route } from '@angular/router';
import { EXPERIMENTS } from './experiments';
import { Home } from './home/home';

export const appRoutes: Route[] = [
  { path: '', component: Home, title: "Tommy's Angular Lab" },
  // Each experiment becomes a lazy route, derived from the registry.
  ...EXPERIMENTS.map<Route>((experiment) => ({
    path: experiment.slug,
    loadComponent: experiment.load,
    title: `${experiment.title} · Tommy's Angular Lab`,
  })),
  { path: '**', redirectTo: '' },
];
```

- [ ] **Step 6: Update `apps/tommy/host/src/app/app.spec.ts`**

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { EXPERIMENTS } from './experiments';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders a sidebar nav link for every registered experiment', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const links =
      fixture.nativeElement.querySelectorAll<HTMLAnchorElement>('.nav-link');
    expect(links.length).toBe(EXPERIMENTS.length);
    expect(links[0].textContent?.trim()).toBe(EXPERIMENTS[0].title);
  });

  it('hosts the command palette and action bar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tommy-action-bar')).toBeTruthy();
    expect(el.querySelector('tommy-command-palette')).toBeTruthy();
  });
});
```

- [ ] **Step 7: Run unit + AOT build**

Run: `pnpm nx test tommy-host` → App + all shell suites PASS.
Run: `pnpm nx build tommy-host` → green (real `strictTemplates`/NG8022 template check).

- [ ] **Step 8: Commit**

```bash
git add apps/tommy/host/src/app/shell/action-bar.ts apps/tommy/host/src/app/app.ts apps/tommy/host/src/app/app.html apps/tommy/host/src/app/app.css apps/tommy/host/src/app/app.routes.ts apps/tommy/host/src/app/app.spec.ts
git commit -m "feat(host): responsive shell — action bar, drawer, ⌘K, light surface"
```

---

### Task 7: Landing page — grouped sections, badges, source links

**Goal:** Rebuild the home page into grouped sections of cards carrying tech badges and a GitHub "view source" link, themed via tokens.

**Files:**
- Modify: `apps/tommy/host/src/app/home/home.ts`
- Modify: `apps/tommy/host/src/app/home/home.html`
- Modify: `apps/tommy/host/src/app/home/home.css`
- Test: `apps/tommy/host/src/app/home/home.spec.ts` (create)

**Acceptance Criteria:**
- [ ] Renders a `.group-title` per group and a `.card` per experiment.
- [ ] Each card shows its `tags` as `.badge[data-variant]` chips and an `Open →` link plus a `.source` GitHub link with `href === sourceUrl(exp)`, `target="_blank"`, `rel="noopener"`.
- [ ] Heading reads "Tommy's Angular Lab"; styles use theme tokens.

**Verify:** `pnpm nx test tommy-host` → `Home` suite passes.

**Steps:**

- [ ] **Step 1: Write the failing test** — `apps/tommy/host/src/app/home/home.spec.ts`

```ts
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { EXPERIMENTS, sourceUrl } from '../experiments';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders grouped cards with badges and source links', () => {
    const f = TestBed.createComponent(Home);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    expect(el.querySelector('.group-title')?.textContent?.trim()).toBe(
      'Signal Forms',
    );
    expect(el.querySelectorAll('.card').length).toBe(EXPERIMENTS.length);

    const totalTags = EXPERIMENTS.reduce((n, e) => n + e.tags.length, 0);
    expect(el.querySelectorAll('.badge').length).toBe(totalTags);

    const firstSource = el.querySelector<HTMLAnchorElement>('.source');
    expect(firstSource?.getAttribute('href')).toBe(sourceUrl(EXPERIMENTS[0]));
    expect(firstSource?.getAttribute('target')).toBe('_blank');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm nx test tommy-host`
Expected: FAIL — no `.group-title`/`.badge`/`.source` yet.

- [ ] **Step 3: Rewrite `apps/tommy/host/src/app/home/home.ts`**

```ts
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { groupExperiments, sourceUrl, tagVariant } from '../experiments';
import { GithubIcon } from '../shell/github-icon';

@Component({
  selector: 'tommy-home',
  imports: [RouterLink, GithubIcon],
  templateUrl: './home.html',
  styleUrl: './home.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  protected readonly groups = groupExperiments();
  protected readonly sourceUrl = sourceUrl;
  protected readonly tagVariant = tagVariant;
}
```

- [ ] **Step 4: Rewrite `apps/tommy/host/src/app/home/home.html`**

```html
<header class="hero">
  <h1>Tommy's Angular Lab</h1>
  <p>A playground for small Angular experiments. Pick one to dive in.</p>
</header>

@for (group of groups; track group.name) {
  <section class="group">
    <h2 class="group-title">{{ group.name }}</h2>
    <div class="grid">
      @for (exp of group.experiments; track exp.slug) {
        <article class="card">
          <a class="card-main" [routerLink]="exp.slug">
            <h3>{{ exp.title }}</h3>
            <p>{{ exp.description }}</p>
          </a>
          @if (exp.tags.length) {
            <div class="tags">
              @for (tag of exp.tags; track tag) {
                <span class="badge" [attr.data-variant]="tagVariant(tag)">{{ tag }}</span>
              }
            </div>
          }
          <div class="card-footer">
            <a class="open" [routerLink]="exp.slug">Open &rarr;</a>
            <a
              class="source"
              [href]="sourceUrl(exp)"
              target="_blank"
              rel="noopener"
              [attr.aria-label]="'View ' + exp.title + ' source on GitHub'"
            >
              <tommy-github-icon /> Source ↗
            </a>
          </div>
        </article>
      }
    </div>
  </section>
} @empty {
  <p>No experiments registered yet.</p>
}
```

- [ ] **Step 5: Rewrite `apps/tommy/host/src/app/home/home.css`**

```css
:host { display: block; max-width: 64rem; }

.hero h1 { margin: 0 0 0.25rem; font-size: 2rem; color: var(--text); }
.hero p { margin: 0 0 2rem; color: var(--text-muted); }

.group + .group { margin-top: 2rem; }
.group-title {
  margin: 0 0 0.75rem;
  font-size: 0.8rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
  gap: 1rem;
}

.card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.card:hover {
  border-color: var(--accent);
  box-shadow: var(--shadow);
  transform: translateY(-2px);
}

.card-main { color: inherit; text-decoration: none; }
.card-main h3 { margin: 0 0 0.35rem; font-size: 1.1rem; color: var(--text); }
.card-main p { margin: 0; color: var(--text-muted); font-size: 0.9rem; }

.tags { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.badge {
  padding: 0.1rem 0.55rem;
  border-radius: 1rem;
  font-size: 0.72rem;
  font-weight: 600;
}
.badge[data-variant='blue'] { background: var(--badge-blue-bg); color: var(--badge-blue-fg); }
.badge[data-variant='orange'] { background: var(--badge-orange-bg); color: var(--badge-orange-fg); }
.badge[data-variant='green'] { background: var(--badge-green-bg); color: var(--badge-green-fg); }
.badge[data-variant='neutral'] { background: var(--badge-neutral-bg); color: var(--badge-neutral-fg); }

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: auto;
}
.open { color: var(--accent); font-weight: 600; font-size: 0.9rem; text-decoration: none; }
.source {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  text-decoration: none;
}
.source:hover { color: var(--text); }
.source tommy-github-icon { width: 1rem; height: 1rem; }
```

- [ ] **Step 6: Run test to verify it passes**

Run: `pnpm nx test tommy-host`
Expected: PASS — `Home` suite green.

- [ ] **Step 7: Commit**

```bash
git add apps/tommy/host/src/app/home/home.ts apps/tommy/host/src/app/home/home.html apps/tommy/host/src/app/home/home.css apps/tommy/host/src/app/home/home.spec.ts
git commit -m "feat(host): grouped landing with tech badges and source links"
```

---

### Task 8: Final integration & verification

**Goal:** Confirm the whole lab lints, tests, builds, and behaves correctly across themes and breakpoints.

**Files:** none (verification only; commit any fixes the checks surface).

**Acceptance Criteria:**
- [ ] `pnpm nx lint tommy-host` clean.
- [ ] `pnpm nx test tommy-host` all suites green.
- [ ] `pnpm nx build tommy-host` green (AOT/strictTemplates).
- [ ] Manual checks below all pass.

**Verify:** `pnpm nx lint tommy-host && pnpm nx test tommy-host && pnpm nx build tommy-host` exits 0.

**Steps:**

- [ ] **Step 1: Run the full gate**

Run: `pnpm nx lint tommy-host && pnpm nx test tommy-host && pnpm nx build tommy-host`
Expected: all three succeed. Fix any lint/type/template errors, then re-run.

- [ ] **Step 2: Manual smoke test**

Run: `pnpm nx serve tommy-host` and verify in a browser:
- Resize across 768px: ≥768 shows the persistent sidebar; <768 shows a hamburger that opens a drawer with a backdrop; tapping a link or the backdrop closes it.
- Theme toggle (☾/☀) flips light/dark, persists across a hard reload, and shows **no flash** of the wrong theme on load.
- Open an experiment in dark mode: it renders on a light surface panel; the sidebar stays dark.
- ⌘K (and Ctrl+K) opens the palette; typing filters; ↑/↓ + ↵ navigates; Esc/backdrop closes.
- The action-bar and sidebar GitHub icons open `https://github.com/tommcamm/angular-tommys-lab`.
- A card's "Source ↗" opens the correct `libs/tommy/<name>` folder on GitHub.

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "chore(host): final polish for Angular Lab shell redesign"
```

---

## Notes

- **Component-style budget:** the production build errors if any single component style exceeds 8kb. Keep the shell component `styles` lean; the bulk of theming lives in global `styles.css` (not subject to the budget). If a component style trips the budget, move shared rules into `styles.css`.
- **`vi` global:** vitest runs with `globals: true`, so `vi`/`describe`/`it`/`expect` need no import (matching the existing specs).
- **Effect-free ThemeService:** DOM/storage writes are imperative so tests assert synchronously without flushing effects.
- **No experiment-lib edits:** the forced-light `.surface-host` is the seam that keeps `@tommy/signal-forms` and `@tommy/multi-step-form` untouched.
- **No empty `catch`:** `no-empty` is on (eslint:recommended). Every `catch` must contain a statement — the `ThemeService` blocks return a value or use `void e`, matching the existing libs (e.g. `multi-step-flow.ts`). The inline script in `index.html` is not linted, so its `catch` may stay comment-only.
