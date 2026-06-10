import { TestBed } from '@angular/core/testing';
import { Injector, signal } from '@angular/core';
import type { FlowEnvelope } from '../../flow-types';
import { buildFlowForm } from '../../forms/build-flow-form';
import { newsletterSchema } from './schema';
import { emptyNewsletterModel } from './model';
import { tosAcksFrom } from '../../steps/tos-step';

const env: FlowEnvelope = {
  features: { NAME: { mandatory: true }, EMAIL: { mandatory: true } },
  terms: {
    privacy: { title: 'Privacy', body: 'b', required: true },
    marketing: { title: 'Marketing', body: 'b', required: false },
  },
};

function build() {
  const model = signal({ ...emptyNewsletterModel(), tos: tosAcksFrom(env.terms) });
  const form = buildFlowForm(model, newsletterSchema, env, TestBed.inject(Injector));
  return { model, form };
}

describe('newsletter schema', () => {
  it('requires name and a valid email', () => {
    const { form } = build();
    expect(form.contact.name().valid()).toBe(false);
    form.contact.email().value.set('not-an-email');
    expect(form.contact.email().valid()).toBe(false);
    form.contact.name().value.set('Tom');
    form.contact.email().value.set('tom@example.com');
    expect(form.contact.name().valid()).toBe(true);
    expect(form.contact.email().valid()).toBe(true);
  });

  it('requires accepting the required term only', () => {
    const { form } = build();
    // privacy (required) unaccepted → tos invalid; marketing optional → fine
    expect(form.tos().valid()).toBe(false);
    form.tos[0]().value.update((v) => ({ ...v, accepted: true })); // privacy
    expect(form.tos().valid()).toBe(true);
  });
});
