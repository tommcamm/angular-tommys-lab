import { Injector, runInInjectionContext, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { defineStep, type FlowDef, type FlowEnvelope } from '../../engine/flow-def';
import { TosStep, type TosAck } from '../../steps/tos-step';
import { emptyModel, type NewsletterModel } from './model';
import { newsletterSchema } from './schema';
import { ContactStep } from './steps/contact-step';
import { PrefsStep } from './steps/prefs-step';

export const newsletterFlow: FlowDef<NewsletterModel> = {
  meta: {
    slug: 'newsletter',
    title: 'Subscribe to the newsletter',
    blurb: 'Two short steps and a consent — the minimal flow.',
    intro: 'Pick how often you want to hear from us. Quick and simple.',
    dimension: 'minimal',
  },
  schemaVersion: 1,
  buildForm: (env: FlowEnvelope, injector: Injector) => {
    const model = signal<NewsletterModel>(emptyModel(env));
    const tree = runInInjectionContext(injector, () => form(model, newsletterSchema(env)));
    return { model, form: tree };
  },
  steps: [
    defineStep<NewsletterModel, NewsletterModel['contact']>({
      key: 'contact',
      label: 'Contact',
      component: ContactStep,
      field: (f) => f.contact,
    }),
    defineStep<NewsletterModel, NewsletterModel['prefs']>({
      key: 'prefs',
      label: 'Preferences',
      component: PrefsStep,
      field: (f) => f.prefs,
    }),
    defineStep<NewsletterModel, TosAck[], FlowEnvelope['terms']>({
      key: 'tos',
      label: 'Terms',
      component: TosStep,
      field: (f) => f.tos,
      data: (env) => env.terms,
    }),
  ],
  toSubmission: (m) => ({
    contact: m.contact,
    prefs: m.prefs,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
