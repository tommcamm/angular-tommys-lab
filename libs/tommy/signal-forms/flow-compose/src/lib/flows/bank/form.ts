import { Injector, runInInjectionContext, untracked, type WritableSignal } from '@angular/core';
import { form } from '@angular/forms/signals';
import type { FlowEnvelope } from '../../flow-types';
import type { BankModel } from './model';
import { bankSchema } from './schema';

export function bankForm(model: WritableSignal<BankModel>, env: FlowEnvelope, injector: Injector) {
  // `form()` registers an internal management effect, which cannot run inside a reactive
  // context — the flow component builds this lazily from a `computed`, so escape it.
  return untracked(() => runInInjectionContext(injector, () => form(model, bankSchema(env))));
}
