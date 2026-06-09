import type { Signature } from './flow-types';

/** What the flow component + runner consult after a MitID round-trip. */
export interface PendingResume {
  /** The serialized model from the single-use snapshot (already `config.snapshot`-shaped). */
  readonly model: unknown;
  /** The MitID proof: challenge id + the one-time code returned by the provider. */
  readonly signature: Signature;
}
