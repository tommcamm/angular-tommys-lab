import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { form, schema } from '@angular/forms/signals';
import { applyFeature, type LengthBounds } from './schema-helpers';
import type { FeatureDescriptor } from '../flow-types';

interface M {
  username: string;
}

type ApplyFeatureOpts = {
  readonly requiredMessage: string;
  readonly minLengthMessage?: (n: number) => string;
  readonly maxLengthMessage?: (n: number) => string;
};

// Mirrors the multi-step-form spec ergonomics: build the form inside
// TestBed's injection context (form()/schema() need an injector). The global
// test-setup configures the zoneless TestBed, so no per-spec providers needed.
function buildWith(
  descriptor: FeatureDescriptor & LengthBounds,
  initial = '',
  opts: Partial<ApplyFeatureOpts> = {},
) {
  const model = signal<M>({ username: initial });
  return TestBed.runInInjectionContext(() =>
    form(
      model,
      schema<M>((p) => {
        applyFeature(p.username, descriptor, {
          requiredMessage: 'Username is required',
          ...opts,
        });
      }),
    ),
  );
}

describe('applyFeature', () => {
  it('marks the field invalid when mandatory and empty', () => {
    const f = buildWith({ mandatory: true });
    expect(f.username().valid()).toBe(false);
    expect(f.username().errors()[0]?.message).toBe('Username is required');
  });

  it('does not require the field when not mandatory', () => {
    const f = buildWith({ mandatory: false });
    expect(f.username().valid()).toBe(true);
  });

  it('enforces minLength with the default message', () => {
    const f = buildWith({ mandatory: false, minLength: 4 }, 'ab');
    expect(f.username().valid()).toBe(false);
    expect(f.username().errors()[0]?.message).toBe(
      'Must be at least 4 characters',
    );
  });

  it('uses a custom minLength message when provided in opts', () => {
    const f = buildWith({ mandatory: false, minLength: 4 }, 'ab', {
      minLengthMessage: (n) => `min ${n}!`,
    });
    expect(f.username().valid()).toBe(false);
    expect(f.username().errors()[0]?.message).toBe('min 4!');
  });
});
