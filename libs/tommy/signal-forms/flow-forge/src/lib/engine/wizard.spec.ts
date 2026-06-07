import { createWizard, type StepState } from './wizard';

const STEPS = [
  { key: 'a', label: 'A' },
  { key: 'b', label: 'B' },
];

function fakeState(opts: {
  valid: boolean;
  errors?: { message?: string; fieldTree: unknown }[];
}): StepState & { resets: number } {
  let resets = 0;
  return {
    valid: () => opts.valid,
    errorSummary: () => opts.errors ?? [],
    reset: () => {
      resets++;
    },
    get resets() {
      return resets;
    },
  };
}

describe('createWizard', () => {
  it('starts on intro, step 0, not attempted', () => {
    const w = createWizard(STEPS);
    expect(w.phase()).toBe('intro');
    expect(w.stepIndex()).toBe(0);
    expect(w.currentKey()).toBe('a');
    expect(w.attempted()).toBe(false);
    expect(w.isFirst()).toBe(true);
    expect(w.isLast()).toBe(false);
  });

  it('advances on a valid step and clears the banner', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    const ok = w.next(fakeState({ valid: true }));
    expect(ok).toBe(true);
    expect(w.stepIndex()).toBe(1);
    // current step is now 'b', which has NOT been validated → not attempted
    expect(w.attempted()).toBe(false);
    expect(w.bannerMessages()).toEqual([]);
  });

  it('freezes a deduped snapshot and resets on an invalid step', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    const fieldX = {};
    const state = fakeState({
      valid: false,
      errors: [
        { message: 'X required', fieldTree: fieldX },
        { message: 'X also bad', fieldTree: fieldX }, // same field → deduped out
        { message: 'Y required', fieldTree: {} },
      ],
    });
    const ok = w.next(state);
    expect(ok).toBe(false);
    expect(w.stepIndex()).toBe(0);
    expect(w.attempted()).toBe(true);
    expect(w.bannerMessages()).toEqual(['X required', 'Y required']);
    expect(state.resets).toBe(1);
  });

  it('back() from step 0 returns to intro; otherwise decrements', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    w.stepIndex.set(1);
    w.back();
    expect(w.stepIndex()).toBe(0);
    w.back();
    expect(w.phase()).toBe('intro');
  });

  it('freezeBanner lets the runner inject server-error messages on a step', () => {
    const w = createWizard(STEPS);
    w.freezeBanner('a', ['That username is taken']);
    expect(w.stepIndex()).toBe(0);
    expect(w.bannerMessages()).toEqual(['That username is taken']);
    expect(w.attempted()).toBe(true);
  });

  it('re-validation rewrites the gate (only a Next press re-runs validation)', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    const bad = w.next(
      fakeState({ valid: false, errors: [{ message: 'X required', fieldTree: {} }] }),
    );
    expect(bad).toBe(false);
    expect(w.stepIndex()).toBe(0);
    expect(w.bannerMessages()).toEqual(['X required']);

    // The gate stays dirty until the next press; a now-valid state flips it clean.
    const ok = w.next(fakeState({ valid: true }));
    expect(ok).toBe(true);
    expect(w.stepIndex()).toBe(1);
    // step 'a' is now clean (validated, no messages)
    w.stepIndex.set(0);
    expect(w.bannerMessages()).toEqual([]);
    expect(w.attempted()).toBe(true);
  });

  it('next on the last step validates but does not advance', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    w.stepIndex.set(STEPS.length - 1);
    expect(w.isLast()).toBe(true);
    const ok = w.next(fakeState({ valid: true }));
    expect(ok).toBe(true);
    expect(w.stepIndex()).toBe(STEPS.length - 1);
  });

  it('reset() clears a dirtied gate back to unvalidated', () => {
    const w = createWizard(STEPS);
    w.phase.set('form');
    w.freezeBanner('a', ['That username is taken']);
    expect(w.attempted()).toBe(true);

    w.reset();
    expect(w.phase()).toBe('intro');
    expect(w.stepIndex()).toBe(0);
    expect(w.attempted()).toBe(false);
  });
});
