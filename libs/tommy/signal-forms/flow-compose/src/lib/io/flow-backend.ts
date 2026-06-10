import { Injectable, InjectionToken, inject } from '@angular/core';
import type {
  FeatureMap,
  FlowEnvelope,
  Signature,
  SubmitOutcome,
  TermsMap,
} from '../flow-types';

const DELAY_MS = 500;
function delay<T>(value: T, ms = DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/** A flow's backend data + rules, contributed by `flows/<flow>/fixtures.ts`. */
export interface FlowFixture<Features extends FeatureMap = FeatureMap> {
  readonly features: Features;
  readonly terms: TermsMap;
  submit(payload: unknown, signature?: Signature): SubmitOutcome;
}

/** Registry of fixtures keyed by flow slug. */
export const FLOW_FIXTURES = new InjectionToken<Map<string, FlowFixture>>('FLOW_FIXTURES');

/**
 * Stand-in for one real HTTP backend: every flow calls the same GET (options) and
 * the same POST (submit); only the slug + data differ. Deterministic on purpose.
 */
@Injectable({ providedIn: 'root' })
export class FlowBackend {
  private readonly fixtures = inject(FLOW_FIXTURES);

  private fixtureFor(slug: string): FlowFixture {
    const f = this.fixtures.get(slug);
    if (!f) throw new Error(`No fixture registered for flow "${slug}"`);
    return f;
  }

  async loadOptions(slug: string): Promise<FlowEnvelope> {
    const f = this.fixtureFor(slug);
    return delay({ features: f.features, terms: f.terms });
  }

  async submit(slug: string, payload: unknown, signature?: Signature): Promise<SubmitOutcome> {
    const f = this.fixtureFor(slug);
    return delay(f.submit(payload, signature));
  }
}
