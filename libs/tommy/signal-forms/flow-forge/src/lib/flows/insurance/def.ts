import { Injector, runInInjectionContext, signal } from '@angular/core';
import { form } from '@angular/forms/signals';
import { defineStep, type FlowDef, type FlowEnvelope } from '../../engine/flow-def';
import { TosStep, type TosAck } from '../../steps/tos-step';
import { emptyModel, type InsuranceModel, type ClaimItem } from './model';
import { insuranceSchema } from './schema';
import { PolicyStep } from './steps/policy-step';
import { IncidentStep } from './steps/incident-step';
import { ItemsStep } from './steps/items-step';

export const insuranceFlow: FlowDef<InsuranceModel> = {
  meta: {
    slug: 'insurance',
    title: 'File an insurance claim',
    blurb: 'Add claimed items, reveal injury details, stay under coverage — the complex flow.',
    intro:
      'Tell us what happened and itemise your claim. We will check the total against your coverage.',
    dimension: 'complex',
  },
  schemaVersion: 1,
  buildForm: (env: FlowEnvelope, injector: Injector) => {
    const model = signal<InsuranceModel>(emptyModel(env));
    const tree = runInInjectionContext(injector, () => form(model, insuranceSchema(env)));
    return { model, form: tree };
  },
  steps: [
    defineStep<InsuranceModel, InsuranceModel['policy']>({
      key: 'policy',
      label: 'Policy',
      component: PolicyStep,
      field: (f) => f.policy,
    }),
    defineStep<InsuranceModel, InsuranceModel['incident']>({
      key: 'incident',
      label: 'Incident',
      component: IncidentStep,
      field: (f) => f.incident,
    }),
    defineStep<InsuranceModel, ClaimItem[]>({
      key: 'items',
      label: 'Items',
      component: ItemsStep,
      field: (f) => f.items,
    }),
    defineStep<InsuranceModel, TosAck[], FlowEnvelope['terms']>({
      key: 'tos',
      label: 'Terms',
      component: TosStep,
      field: (f) => f.tos,
      data: (env) => env.terms,
    }),
  ],
  toSubmission: (m) => ({
    policy: m.policy,
    incident: m.incident,
    items: m.items,
    acceptedTermIds: m.tos.filter((t) => t.accepted).map((t) => t.id),
  }),
};
