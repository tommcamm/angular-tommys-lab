import type { Route } from '@angular/router';

/** A lazily-loaded standalone component, as accepted by `Route.loadComponent`. */
type ComponentLoader = NonNullable<Route['loadComponent']>;

/**
 * One pluggable experiment in the host.
 *
 * This is the single source of truth: the sidebar nav, the landing-page cards,
 * and the router config are all derived from {@link EXPERIMENTS}. To add an
 * experiment, create its `@tommy/*` library and append one entry below — nothing
 * else in the host needs to change.
 */
export interface Experiment {
  /** URL slug, e.g. `'signal-forms'` → `/signal-forms`. Must be unique. */
  readonly slug: string;
  /** Display name shown in the nav and on the landing card. */
  readonly title: string;
  /** One-line summary shown on the landing card. */
  readonly description: string;
  /** Lazy loader for the experiment's entry component (own JS chunk). */
  readonly load: ComponentLoader;
}

export const EXPERIMENTS: readonly Experiment[] = [
  {
    slug: 'signal-forms',
    title: 'Signal Forms',
    description:
      'A sign-up form built on the experimental @angular/forms/signals API.',
    load: () => import('@tommy/signal-forms').then((m) => m.TommySignalForms),
  },
  {
    slug: 'multi-step-form',
    title: 'Multi-Step Form',
    description:
      'A signup-style wizard on @angular/forms/signals: backend-driven constraints, composed schemas, and a server-error submit.',
    load: () =>
      import('@tommy/multi-step-form').then((m) => m.MultiStepFlow),
  },
];
