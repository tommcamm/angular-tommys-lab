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
