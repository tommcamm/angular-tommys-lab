import { Route } from '@angular/router';
import { EXPERIMENTS } from './experiments';
import { Home } from './home/home';

export const appRoutes: Route[] = [
  { path: '', component: Home, title: 'Tommy Labs · Experiments' },
  // Each experiment becomes a lazy route, derived from the registry.
  ...EXPERIMENTS.map<Route>((experiment) => ({
    path: experiment.slug,
    loadComponent: experiment.load,
    title: `Tommy Labs · ${experiment.title}`,
  })),
  { path: '**', redirectTo: '' },
];
