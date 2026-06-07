import type { Route } from '@angular/router';

/** A lazily-loaded standalone component, as accepted by `Route.loadComponent`. */
export type ComponentLoader = NonNullable<Route['loadComponent']>;

/** Badge color variants for experiment tags. */
export type TagVariant = 'blue' | 'orange' | 'green' | 'neutral';

/**
 * One pluggable experiment in the host — the single source of truth. The sidebar,
 * the landing-page cards, the command palette, and the router config are all
 * derived from `EXPERIMENTS`. To add an experiment, create its `@tommy/*`
 * library and append one entry to the registry.
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

/** A named category with its experiments, as produced by `groupExperiments`. */
export interface ExperimentGroup {
  readonly name: string;
  readonly experiments: readonly Experiment[];
}
