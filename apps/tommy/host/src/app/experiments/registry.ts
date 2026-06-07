import type { Experiment } from './experiment.model';

/** GitHub repository the lab lives in. */
export const REPO_URL = 'https://github.com/tommcamm/angular-tommys-lab';

/**
 * The pluggable experiments rendered by the host. This array is the single
 * source of truth: the sidebar, landing-page cards, command palette, and router
 * config are all derived from it (see {@link ./experiment.utils}).
 */
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
    tags: ['signals', 'multi-step', 'experimental'],
    sourcePath: 'libs/tommy/multi-step-form',
    load: () =>
      import('@tommy/multi-step-form').then((m) => m.MultiStepFlow),
  },
];
