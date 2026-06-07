import type { AnyFlowDef } from './engine/flow-def';
import type { FlowFixture } from './engine/flow-backend';
import { newsletterFlow } from './flows/newsletter/def';
import { newsletterFixture } from './flows/newsletter/fixtures';
import { bankFlow } from './flows/bank/def';
import { bankFixture } from './flows/bank/fixtures';

/** All flows registered in this experiment (Plan 2 appends insurance + bank). */
export const FLOWS: readonly AnyFlowDef[] = [newsletterFlow as AnyFlowDef, bankFlow as AnyFlowDef];

/** slug → fixture map consumed by FlowBackend (provided by the launcher). */
export const FIXTURES = new Map<string, FlowFixture>([
  ['newsletter', newsletterFixture as FlowFixture],
  ['bank', bankFixture as FlowFixture],
]);
