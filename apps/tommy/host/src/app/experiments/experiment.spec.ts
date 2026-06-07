import type { Experiment } from './experiment.model';
import { EXPERIMENTS, REPO_URL } from './registry';
import { groupExperiments, sourceUrl, tagVariant } from './experiment.utils';

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
      'flow-forge',
    ]);
  });

  it('builds a GitHub source URL', () => {
    expect(sourceUrl(EXPERIMENTS[0])).toBe(
      `${REPO_URL}/tree/main/libs/tommy/signal-forms/simple-form`,
    );
  });

  it('maps tags to badge variants with a neutral fallback', () => {
    expect(tagVariant('signals')).toBe('blue');
    expect(tagVariant('multi-step')).toBe('green');
    expect(tagVariant('totally-unknown')).toBe('neutral');
  });

  it('handles multiple groups, preserving insertion order', () => {
    const load = () => Promise.resolve({} as never);
    const fake = [
      { slug: 'a', title: 'A', description: '', group: 'G1', tags: [], sourcePath: 'p/a', load },
      { slug: 'b', title: 'B', description: '', group: 'G2', tags: [], sourcePath: 'p/b', load },
      { slug: 'c', title: 'C', description: '', group: 'G1', tags: [], sourcePath: 'p/c', load },
    ] satisfies Experiment[];
    const groups = groupExperiments(fake);
    expect(groups.map((g) => g.name)).toEqual(['G1', 'G2']);
    expect(groups[0].experiments.map((e) => e.slug)).toEqual(['a', 'c']);
    expect(groups[1].experiments.map((e) => e.slug)).toEqual(['b']);
  });
});
