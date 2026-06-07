import { computed, signal, type Signal, type WritableSignal } from '@angular/core';

export type Phase = 'intro' | 'form' | 'done';

/** The minimal slice of a signal-forms FieldState the wizard needs to gate a step. */
export interface StepState {
  valid(): boolean;
  errorSummary(): readonly { readonly message?: string; readonly fieldTree: unknown }[];
  reset(): void;
}

export interface StepMeta {
  readonly key: string;
  readonly label: string;
}

export interface Wizard {
  readonly phase: WritableSignal<Phase>;
  readonly stepIndex: WritableSignal<number>;
  readonly steps: readonly StepMeta[];
  readonly labels: readonly string[];
  readonly currentKey: Signal<string>;
  readonly isFirst: Signal<boolean>;
  readonly isLast: Signal<boolean>;
  readonly attempted: Signal<boolean>;
  readonly bannerMessages: Signal<readonly string[]>;
  next(state: StepState): boolean;
  validateCurrent(state: StepState): boolean;
  back(): void;
  reset(): void;
  freezeBanner(key: string, messages: readonly string[]): void;
}

/**
 * Frozen-snapshot gate (ported from multi-step-flow.ts):
 *  - `null`  → step not validated yet
 *  - `[]`    → validated and clean
 *  - `[...]` → validated and invalid; a frozen snapshot of banner messages
 */
type Gate = Record<string, readonly string[] | null>;

function snapshotMessages(
  errors: readonly { readonly message?: string; readonly fieldTree: unknown }[],
): readonly string[] {
  const seen = new Set<unknown>();
  const messages: string[] = [];
  for (const error of errors) {
    if (seen.has(error.fieldTree)) continue;
    seen.add(error.fieldTree);
    if (error.message) messages.push(error.message);
  }
  return messages;
}

export function createWizard(steps: readonly StepMeta[]): Wizard {
  const phase = signal<Phase>('intro');
  const stepIndex = signal(0);
  const gate = signal<Gate>(Object.fromEntries(steps.map((s) => [s.key, null])));

  const currentKey = computed(() => steps[stepIndex()].key);
  const isFirst = computed(() => stepIndex() === 0);
  const isLast = computed(() => stepIndex() === steps.length - 1);
  const attempted = computed(() => gate()[currentKey()] !== null);
  const bannerMessages = computed<readonly string[]>(() => gate()[currentKey()] ?? []);

  const setGate = (key: string, value: readonly string[]) =>
    gate.update((g) => ({ ...g, [key]: value }));

  const validateCurrent = (state: StepState): boolean => {
    const key = currentKey();
    if (state.valid()) {
      setGate(key, []);
      return true;
    }
    setGate(key, snapshotMessages(state.errorSummary()));
    state.reset();
    return false;
  };

  const next = (state: StepState): boolean => {
    if (!validateCurrent(state)) return false;
    if (!isLast()) stepIndex.update((i) => i + 1);
    return true;
  };

  const back = (): void => {
    if (isFirst()) {
      phase.set('intro');
      return;
    }
    stepIndex.update((i) => i - 1);
  };

  const reset = (): void => {
    phase.set('intro');
    stepIndex.set(0);
    gate.set(Object.fromEntries(steps.map((s) => [s.key, null])));
  };

  const freezeBanner = (key: string, messages: readonly string[]): void => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx >= 0) stepIndex.set(idx);
    setGate(key, messages);
  };

  return {
    phase,
    stepIndex,
    steps,
    labels: steps.map((s) => s.label),
    currentKey,
    isFirst,
    isLast,
    attempted,
    bannerMessages,
    next,
    validateCurrent,
    back,
    reset,
    freezeBanner,
  };
}
