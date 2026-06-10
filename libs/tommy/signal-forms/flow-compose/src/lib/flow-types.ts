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
/** The 200 arm of SubmitOutcome — exported for the receipt slot context. */
export type SubmitOk = {
  readonly status: 'ok';
  readonly httpStatus: 200;
  readonly confirmationId: string;
};
export type SubmitOutcome =
  | SubmitOk
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

// ---- Flow meta (no `intro` — the flowIntro slot owns intro copy) -------------------
export interface FlowMeta {
  readonly slug: string;
  readonly title: string;
  readonly blurb: string;
  readonly dimension: 'minimal' | 'complex' | 'signing';
}

export type { FieldTree };
