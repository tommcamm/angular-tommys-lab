import { TestBed } from '@angular/core/testing';
import { Injector } from '@angular/core';
import type { FlowOptions } from './flow-options';
import { createFlowForm } from './create-flow-form';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [{ id: 'terms', title: 'Terms', body: '', required: true }],
};

describe('createFlowForm', () => {
  it('builds a form bound to a model seeded from options', () => {
    TestBed.runInInjectionContext(() => {
      const injector = TestBed.inject(Injector);
      const { model, form } = createFlowForm(OPTS, injector);
      expect(model().tos.length).toBe(1);
      expect(form().valid()).toBe(false);

      // Mutating the model is reflected in the form (reactivity is wired).
      model.update((m) => ({ ...m, account: { ...m.account, username: 'ab' } }));
      expect(form.account.username().invalid()).toBe(true);
    });
  });
});
