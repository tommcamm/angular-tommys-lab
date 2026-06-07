import type {
  Experiment,
  ExperimentGroup,
  TagVariant,
} from './experiment.model';
import { EXPERIMENTS, REPO_URL } from './registry';

const TAG_VARIANTS: Readonly<Record<string, TagVariant>> = {
  signals: 'blue',
  experimental: 'orange',
  'multi-step': 'green',
};

/** Variant for a tag chip; unknown tags render neutral. */
export function tagVariant(tag: string): TagVariant {
  return TAG_VARIANTS[tag] ?? 'neutral';
}

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
