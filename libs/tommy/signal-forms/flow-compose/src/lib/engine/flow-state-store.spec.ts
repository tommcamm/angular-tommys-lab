import { TestBed } from '@angular/core/testing';
import { FlowStateStore } from './flow-state-store';

describe('FlowStateStore', () => {
  let store: FlowStateStore;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [FlowStateStore] });
    store = TestBed.inject(FlowStateStore);
  });

  const snap = {
    flowSlug: 'bank',
    schemaVersion: 1,
    state: 'nonce-123',
    challengeId: 'ch-1',
    model: { a: 1 },
  };

  it('round-trips a snapshot', () => {
    store.save(snap);
    expect(store.restore('bank', 1)).toEqual(snap);
  });

  it('is single-use: a second restore returns null', () => {
    store.save(snap);
    store.restore('bank', 1);
    expect(store.restore('bank', 1)).toBeNull();
  });

  it('discards on schemaVersion mismatch', () => {
    store.save(snap);
    expect(store.restore('bank', 2)).toBeNull();
  });

  it('returns null when nothing is stored', () => {
    expect(store.restore('bank', 1)).toBeNull();
  });
});
