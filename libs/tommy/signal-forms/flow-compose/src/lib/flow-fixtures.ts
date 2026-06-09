import type { FlowFixture } from './engine/flow-backend';
import { newsletterFixture } from './flows/newsletter/fixtures';
import { bankFixture } from './flows/bank/fixtures';
import { insuranceFixture } from './flows/insurance/fixtures';

export const FLOW_FIXTURES_MAP = new Map<string, FlowFixture>([
  ['newsletter', newsletterFixture],
  ['bank', bankFixture],
  ['insurance', insuranceFixture],
]);
