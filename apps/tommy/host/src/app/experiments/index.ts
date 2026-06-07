/**
 * Public surface of the experiments registry. Importers use `'../experiments'`
 * (or `'./experiments'`), which resolves to this barrel — so the registry can be
 * split across `experiment.model`, `registry`, and `experiment.utils` without
 * touching any consumer.
 */
export type {
  ComponentLoader,
  Experiment,
  ExperimentGroup,
  TagVariant,
} from './experiment.model';
export { EXPERIMENTS, REPO_URL } from './registry';
export { groupExperiments, sourceUrl, tagVariant } from './experiment.utils';
