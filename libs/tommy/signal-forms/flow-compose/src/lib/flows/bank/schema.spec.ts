import { TestBed } from '@angular/core/testing';
import { Injector, signal } from '@angular/core';
import type { FlowEnvelope } from '../../flow-types';
import { buildFlowForm } from '../../forms/build-flow-form';
import { bankSchema } from './schema';
import { emptyBankModel } from './model';
import { tosAcksFrom } from '../../steps/tos-step';

const env: FlowEnvelope = {
  features: { FULL_NAME: { mandatory: true }, CPR: { mandatory: true }, ACCOUNT_TYPE: { mandatory: true } },
  terms: { tos: { title: 'Terms', body: 'b', required: true } },
};

function build() {
  const model = signal({ ...emptyBankModel(), tos: tosAcksFrom(env.terms) });
  const form = buildFlowForm(model, bankSchema, env, TestBed.inject(Injector));
  return { model, form };
}

describe('bank schema', () => {
  it('requires applicant fields and an account type', () => {
    const { form } = build();
    expect(form.applicant.fullName().valid()).toBe(false);
    form.applicant.fullName().value.set('Tove Hansen');
    form.applicant.cpr().value.set('0101901234');
    expect(form.applicant().valid()).toBe(true);
    expect(form.account.accountType().valid()).toBe(false); // empty default
    form.account.accountType().value.set('standard');
    expect(form.account.accountType().valid()).toBe(true);
  });
});
