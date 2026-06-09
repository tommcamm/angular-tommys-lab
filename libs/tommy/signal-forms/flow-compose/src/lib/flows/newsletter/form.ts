import { Injector, runInInjectionContext, untracked, type WritableSignal } from '@angular/core';
import { form } from '@angular/forms/signals';
import type { FlowEnvelope } from '../../engine/flow-types';
import type { NewsletterModel } from './model';
import { newsletterSchema } from './schema';

export function newsletterForm(model: WritableSignal<NewsletterModel>, env: FlowEnvelope, injector: Injector) {
  // `form()` registers an internal management effect, which cannot run inside a reactive
  // context — the flow component builds this lazily from a `computed`, so escape it.
  return untracked(() => runInInjectionContext(injector, () => form(model, newsletterSchema(env))));
}
