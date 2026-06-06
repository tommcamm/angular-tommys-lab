import type { Route } from '@angular/router';

/** A lazily-loaded standalone component, as accepted by `Route.loadComponent`. */
type ComponentLoader = NonNullable<Route['loadComponent']>;

/** GitHub repository the lab lives in. */
export const REPO_URL = 'https://github.com/tommcamm/angular-tommys-lab';

/** Badge color variants for experiment tags. */
export type TagVariant = 'blue' | 'orange' | 'green' | 'neutral';

const TAG_VARIANTS: Readonly<Record<string, TagVariant>> = {
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
    load: () =>
      import('@tommy/multi-step-form').then((m) => m.MultiStepFlow),
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
  // Branch is intentionally hard-coded: this lab only ever lives on `main`.
  return `${REPO_URL}/tree/main/${e.sourcePath}`;
}
