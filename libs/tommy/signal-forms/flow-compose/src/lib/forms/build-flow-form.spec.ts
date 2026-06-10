import { TestBed } from '@angular/core/testing';
import { Injector, computed, signal } from '@angular/core';
import { schema, validate } from '@angular/forms/signals';
import { buildFlowForm } from './build-flow-form';
import type { FlowEnvelope } from '../flow-types';

interface M { name: string; }
const ENV: FlowEnvelope = { features: {}, terms: {} };
const nameSchema = (_env: FlowEnvelope) =>
  schema<M>((p) =>
    validate(p.name, (ctx) => (ctx.value() ? null : { kind: 'required', message: 'Name required' })),
  );

describe('buildFlowForm', () => {
  it('builds a usable form via the {injector} option (no runInInjectionContext)', () => {
    const injector = TestBed.inject(Injector);
    const model = signal<M>({ name: '' });
    const f = buildFlowForm(model, nameSchema, ENV, injector);
    expect(f.name().valid()).toBe(false);
    model.set({ name: 'Tommy' });
    expect(f.name().valid()).toBe(true);
  });

  it('can be built inside a computed and returns a functional form (untracked escapes the reactive context)', () => {
    const injector = TestBed.inject(Injector);
    const model = signal<M>({ name: 'x' });
    const formC = computed(() => buildFlowForm(model, nameSchema, ENV, injector));
    expect(() => formC()).not.toThrow();
    expect(formC().name().valid()).toBe(true);
  });
});
