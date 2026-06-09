import { TestBed } from '@angular/core/testing';
import { FlowResume } from './flow-resume';
import { FlowStateStore } from './flow-state-store';

function qmap(params: Record<string, string>) {
  return { get: (k: string) => params[k] ?? null };
}
const VERSION = () => 1;

function saveSnapshot(state: string) {
  TestBed.inject(FlowStateStore).save({
    flowSlug: 'bank', schemaVersion: 1, state, challengeId: 'ch-1', model: { a: 1 },
  });
}

describe('FlowResume', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [FlowResume, FlowStateStore] });
    sessionStorage.clear();
  });
  afterEach(() => sessionStorage.clear());

  it('approved callback with matching state → slug + pending (multi-read)', () => {
    saveSnapshot('st-1');
    const r = TestBed.inject(FlowResume);
    const slug = r.consume(qmap({ mitid: 'callback', flow: 'bank', status: 'approved', state: 'st-1', code: 'otc' }), VERSION);
    expect(slug).toBe('bank');
    const a = r.pending('bank');
    const b = r.pending('bank');
    expect(a).toEqual({ model: { a: 1 }, signature: { challengeId: 'ch-1', code: 'otc' } });
    expect(b).toEqual(a); // multi-read
    expect(r.cancelledNotice('bank')).toBe(false);
  });

  it('cancelled callback → slug + cancelledNotice, no pending', () => {
    saveSnapshot('st-2');
    const r = TestBed.inject(FlowResume);
    const slug = r.consume(qmap({ mitid: 'callback', flow: 'bank', status: 'cancelled', state: 'st-2' }), VERSION);
    expect(slug).toBe('bank');
    expect(r.pending('bank')).toBeNull();
    expect(r.cancelledNotice('bank')).toBe(true);
  });

  it('state mismatch (replay) → null, no pending', () => {
    saveSnapshot('st-real');
    const r = TestBed.inject(FlowResume);
    expect(r.consume(qmap({ mitid: 'callback', flow: 'bank', status: 'approved', state: 'st-evil', code: 'x' }), VERSION)).toBeNull();
    expect(r.pending('bank')).toBeNull();
  });

  it('no callback params → null', () => {
    const r = TestBed.inject(FlowResume);
    expect(r.consume(qmap({}), VERSION)).toBeNull();
  });

  it('unknown slug (versionFor undefined) → null', () => {
    saveSnapshot('st-3');
    const r = TestBed.inject(FlowResume);
    expect(r.consume(qmap({ mitid: 'callback', flow: 'ghost', status: 'approved', state: 'st-3', code: 'x' }), () => undefined)).toBeNull();
  });
});
