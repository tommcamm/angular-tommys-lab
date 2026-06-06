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
