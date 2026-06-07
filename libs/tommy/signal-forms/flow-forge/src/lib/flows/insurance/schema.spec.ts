import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { insuranceFlow } from './def';
import type { FlowEnvelope } from '../../engine/flow-def';
import type { InsuranceFeatures } from './fixtures';

const env: FlowEnvelope<InsuranceFeatures> = {
  features: {
    POLICY_NUMBER: { mandatory: true },
    INCIDENT_DATE: { mandatory: true },
    AMOUNT: { mandatory: true, maxAmount: 1000 },
  },
  terms: { tos: { title: 'Terms', body: 'b', required: true } },
};
const build = () => insuranceFlow.buildForm(env, TestBed.inject(Injector));

describe('insurance schema', () => {
  it('requires injury details only when injured is true', () => {
    const { form } = build();
    expect(form.incident.injured().value()).toBe(false);
    form.incident.date().value.set('2026-01-01');
    form.incident.description().value.set('Fender bender');
    expect(form.incident().valid()).toBe(true); // not injured → injuryDetails not required
    form.incident.injured().value.set(true);
    expect(form.incident().valid()).toBe(false); // now injuryDetails required
    form.incident.injuryDetails().value.set('Sprained wrist');
    expect(form.incident().valid()).toBe(true);
  });

  it('flags total claimed over coverage', () => {
    const { form, model } = build();
    model.update((m) => ({
      ...m,
      items: [
        { description: 'TV', amount: 800 },
        { description: 'Phone', amount: 400 },
      ],
    }));
    expect(form.items().valid()).toBe(false); // 1200 > 1000
    model.update((m) => ({ ...m, items: [{ description: 'TV', amount: 800 }] }));
    expect(form.items().valid()).toBe(true); // 800 <= 1000
  });
});
