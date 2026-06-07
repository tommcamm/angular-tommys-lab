import type { InputSignal, Injector, Type, WritableSignal } from '@angular/core';
import type { FieldTree } from '@angular/forms/signals';

// ---- Backend envelope: uniform { features, terms }; keys differ per flow ----------
export interface FeatureDescriptor {
  readonly mandatory: boolean;
}
export type FeatureMap = Readonly<Record<string, FeatureDescriptor>>;

export interface TermDescriptor {
  readonly title: string;
  readonly body: string;
  readonly required: boolean;
}
export type TermsMap = Readonly<Record<string, TermDescriptor>>;

export interface FlowEnvelope<Features extends FeatureMap = FeatureMap> {
  readonly features: Features;
  readonly terms: TermsMap;
}

// ---- Submission outcome (realistic HTTP status semantics) --------------------------
export interface ServerFieldError {
  readonly field: string;
  readonly message: string;
}
export interface Signature {
  readonly challengeId: string;
  readonly code: string;
}
export type SubmitOutcome =
  | { readonly status: 'ok'; readonly httpStatus: 200; readonly confirmationId: string }
  | {
      readonly status: 'signing_required';
      readonly httpStatus: 202;
      readonly signingUrl: string;
      readonly challengeId: string;
    }
  | {
      readonly status: 'rejected';
      readonly httpStatus: 422;
      readonly errors: readonly ServerFieldError[];
    };

// ---- Form bundle -------------------------------------------------------------------
export interface FlowForm<Model> {
  readonly model: WritableSignal<Model>;
  readonly form: FieldTree<Model>;
}

// ---- Step contract (typed; engine binds a FIXED input set) -------------------------
export interface StepComponent<Slice, Data = never> {
  readonly field: InputSignal<FieldTree<Slice>>;
  readonly showErrors: InputSignal<boolean>;
  readonly data?: InputSignal<Data>;
}

export interface StepDef<Model> {
  readonly key: string;
  readonly label: string;
  readonly component: Type<StepComponent<unknown, unknown>>;
  field(form: FieldTree<Model>): FieldTree<unknown>;
  data?(env: FlowEnvelope): unknown;
}

export function defineStep<Model, Slice, Data = never>(cfg: {
  key: string;
  label: string;
  component: Type<StepComponent<Slice, Data>>;
  field: (form: FieldTree<Model>) => FieldTree<Slice>;
  data?: (env: FlowEnvelope) => Data;
}): StepDef<Model> {
  return cfg as unknown as StepDef<Model>;
}

// ---- The flow contract -------------------------------------------------------------
export interface FlowMeta {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly intro: string;
  readonly dimension: 'minimal' | 'complex' | 'signing';
}

export interface FlowDef<Model, Features extends FeatureMap = FeatureMap> {
  readonly meta: FlowMeta;
  readonly schemaVersion: number;
  buildForm(env: FlowEnvelope<Features>, injector: Injector): FlowForm<Model>;
  readonly steps: readonly StepDef<Model>[];
  toSubmission(model: Model): unknown;
  mapServerError?(
    err: ServerFieldError,
    form: FieldTree<Model>,
  ): { stepKey: string; fieldTree: FieldTree<unknown> };
  snapshot?(model: Model): unknown;
  restore?(raw: unknown): Model;
}

export type AnyFlowDef = FlowDef<unknown, FeatureMap>;
