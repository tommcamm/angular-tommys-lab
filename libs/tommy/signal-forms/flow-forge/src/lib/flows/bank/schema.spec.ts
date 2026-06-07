import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import { bankFlow } from './def';
import type { FlowEnvelope } from '../../engine/flow-def';

const env: FlowEnvelope = {
  features: { FULL_NAME: { mandatory: true }, CPR: { mandatory: true }, ACCOUNT_TYPE: { mandatory: true } },
  terms: { tos: { title: 'Terms', body: 'b', required: true } },
};
const build = () => bankFlow.buildForm(env, TestBed.inject(Injector));

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
