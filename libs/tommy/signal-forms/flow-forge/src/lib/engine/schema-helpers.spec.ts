import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { form, schema } from '@angular/forms/signals';
import { applyFeature } from './schema-helpers';
import type { FeatureDescriptor } from './flow-def';

interface M {
  username: string;
}

// Mirrors the multi-step-form spec ergonomics: build the form inside
// TestBed's injection context (form()/schema() need an injector). The global
// test-setup configures the zoneless TestBed, so no per-spec providers needed.
function buildWith(descriptor: FeatureDescriptor & { minLength?: number }) {
  const model = signal<M>({ username: '' });
  return TestBed.runInInjectionContext(() =>
    form(
      model,
      schema<M>((p) => {
        applyFeature(p.username, descriptor, {
          requiredMessage: 'Username is required',
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
});
