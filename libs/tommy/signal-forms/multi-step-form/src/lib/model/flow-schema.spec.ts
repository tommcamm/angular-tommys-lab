import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import type { FlowOptions } from './flow-options';
import {
  emptyFlowModel,
  type AccountGroup,
  type FlowModel,
  type ProfileGroup,
  type TosAck,
} from './flow-model';
import { flowSchema } from './flow-schema';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [
    { id: 'terms', title: 'Terms', body: '', required: true },
    { id: 'news', title: 'News', body: '', required: false },
  ],
};

// Top-level keys are optional, but each provided sub-object must be complete
// (avoids silently producing a malformed model via a partial AccountGroup, etc).
function build(initial?: {
  profile?: ProfileGroup;
  account?: AccountGroup;
  tos?: TosAck[];
}) {
  return TestBed.runInInjectionContext(() => {
    const model = signal<FlowModel>({ ...emptyFlowModel(OPTS), ...initial });
    return { model, form: form(model, flowSchema(OPTS)) };
  });
}

describe('flowSchema (composed signal-forms logic)', () => {
  it('is invalid when empty', () => {
    const { form } = build();
    expect(form().valid()).toBe(false);
  });

  it('applies backend username min length', () => {
    const { model, form } = build();
    model.update((m) => ({ ...m, account: { ...m.account, username: 'abc' } })); // 3 < 4
    expect(form.account.username().invalid()).toBe(true);
    model.update((m) => ({
      ...m,
      account: { ...m.account, username: 'abcd' },
    })); // 4
    expect(
      form.account
        .username()
        .errors()
        .some((e) => e.kind === 'minLength'),
    ).toBe(false);
  });

  it('requires confirmPassword to match password', () => {
    const { model, form } = build({
      account: {
        username: 'tommy',
        password: 'super-secret',
        confirmPassword: 'nope',
      },
    });
    expect(
      form.account
        .confirmPassword()
        .errors()
        .some((e) => e.kind === 'passwordMismatch'),
    ).toBe(true);
    model.update((m) => ({
      ...m,
      account: { ...m.account, confirmPassword: 'super-secret' },
    }));
    expect(form.account.confirmPassword().valid()).toBe(true);
  });

  it('requires required TOS items but ignores optional ones', () => {
    const { model, form } = build();
    expect(form.tos().valid()).toBe(false); // 'terms' required, not accepted
    model.update((m) => ({
      ...m,
      tos: m.tos.map((t) => (t.required ? { ...t, accepted: true } : t)),
    }));
    expect(form.tos().valid()).toBe(true); // optional 'news' left false is fine
  });

  it('becomes valid once every group is valid and exposes the full value', () => {
    const { form } = build({
      profile: {
        firstName: 'Tommy',
        lastName: 'C',
        email: 'tommy@example.com',
      },
      account: {
        username: 'tommy',
        password: 'super-secret',
        confirmPassword: 'super-secret',
      },
      tos: [
        { id: 'terms', required: true, accepted: true },
        { id: 'news', required: false, accepted: false },
      ],
    });
    expect(form().valid()).toBe(true);
    expect(form().value().account.username).toBe('tommy');
    expect(form().value().tos.length).toBe(2);
  });

  it('emptyFlowModel seeds the TOS array from options', () => {
    const model = emptyFlowModel(OPTS);
    expect(model.tos.map((t) => t.id)).toEqual(['terms', 'news']);
    expect(model.tos.find((t) => t.id === 'terms')?.required).toBe(true);
    expect(model.tos.every((t) => t.accepted === false)).toBe(true);
  });

  it('applies backend username max length', () => {
    const { model, form } = build();
    model.update((m) => ({
      ...m,
      account: { ...m.account, username: 'a'.repeat(21) },
    })); // > 20
    expect(
      form.account
        .username()
        .errors()
        .some((e) => e.kind === 'maxLength'),
    ).toBe(true);
  });

  it('rejects a malformed profile email', () => {
    const { model, form } = build();
    model.update((m) => ({
      ...m,
      profile: { ...m.profile, email: 'not-an-email' },
    }));
    expect(form.profile.email().invalid()).toBe(true);
    model.update((m) => ({
      ...m,
      profile: { ...m.profile, email: 'tommy@example.com' },
    }));
    expect(form.profile.email().valid()).toBe(true);
  });

  it('does not report a password mismatch when both fields are empty', () => {
    const { form } = build();
    expect(
      form.account
        .confirmPassword()
        .errors()
        .some((e) => e.kind === 'passwordMismatch'),
    ).toBe(false);
  });
});
