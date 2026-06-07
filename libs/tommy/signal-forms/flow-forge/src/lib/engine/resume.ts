import type { Signature } from './flow-def';

/** Data the launcher hands a runner to complete a flow after a MitID round-trip. */
export interface ResumeData {
  /** The serialized model from the pre-redirect snapshot (already `def.snapshot`-shaped). */
  readonly model: unknown;
  /** The MitID proof: challenge id + the one-time code returned by the provider. */
  readonly signature: Signature;
}
