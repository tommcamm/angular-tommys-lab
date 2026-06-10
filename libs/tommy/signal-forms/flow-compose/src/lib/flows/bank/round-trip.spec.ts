import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { BankFlow } from './bank-flow';
import { FlowBackend, FLOW_FIXTURES } from '../../io/flow-backend';
import { ExternalRedirect } from '../../io/external-redirect';
import { FlowStateStore } from '../../io/flow-state-store';
import { FlowResume } from '../../io/flow-resume';
import { bankFixture } from './fixtures';

class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'http://localhost:4200';
  to(url: string): void { this.lastUrl = url; }
}
const SNAPSHOT_KEY = 'flow-compose:snapshot';

function configure(redirect: FakeRedirect) {
  TestBed.configureTestingModule({
    imports: [BankFlow],
    providers: [
      FlowBackend, FlowStateStore, FlowResume,
      { provide: ExternalRedirect, useValue: redirect },
      { provide: FLOW_FIXTURES, useValue: new Map([['bank', bankFixture]]) },
    ],
  });
}

async function start(fixture: ComponentFixture<BankFlow>) {
  // env loads eagerly on mount (real 500ms); wait, then click Start.
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
  clickByText(fixture, 'Start');
}
function clickByText(fixture: ComponentFixture<BankFlow>, text: string) {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text || (b.textContent ?? '').includes(text));
  if (!btn) throw new Error(`button not found: ${text}`);
  btn.click();
  fixture.detectChanges();
}
function setInput(fixture: ComponentFixture<BankFlow>, sel: string, val: string) {
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(sel);
  if (!input) throw new Error(`input not found: ${sel}`);
  input.value = val; input.dispatchEvent(new Event('input', { bubbles: true })); fixture.detectChanges();
}
function pickRadio(fixture: ComponentFixture<BankFlow>, value: string) {
  const radio = Array.from((fixture.nativeElement as HTMLElement).querySelectorAll<HTMLInputElement>('input[type=radio]')).find((r) => r.value === value);
  if (!radio) throw new Error(`radio not found: ${value}`);
  radio.click(); fixture.detectChanges();
}
function acceptFirstTerm(fixture: ComponentFixture<BankFlow>) {
  const box = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>('input[type=checkbox]');
  if (!box) throw new Error('TOS checkbox not found');
  box.click(); fixture.detectChanges();
}
async function clickSubmit(fixture: ComponentFixture<BankFlow>) {
  clickByText(fixture, 'Submit');
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

interface PersistedSnapshot { flowSlug: string; schemaVersion: number; state: string; challengeId: string; model: unknown; }

describe('Bank flow — MitID round-trip (v2, seam-faked integration)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('submit → 202 → approved callback → resume → 200 done (BANK-bank-0001)', async () => {
    // PHASE A: drive the bank-flow component to submit → 202 → snapshot + redirect.
    const redirect = new FakeRedirect();
    configure(redirect);
    const fixtureA = TestBed.createComponent(BankFlow);
    fixtureA.detectChanges();
    await start(fixtureA);
    setInput(fixtureA, '#bank-fullName', 'Tommy Tester');
    setInput(fixtureA, '#bank-cpr', '0101010001');
    clickByText(fixtureA, 'Next');
    pickRadio(fixtureA, 'standard');
    clickByText(fixtureA, 'Next');
    acceptFirstTerm(fixtureA);
    await clickSubmit(fixtureA);

    expect(redirect.lastUrl).not.toBeNull();
    const signingUrl = new URL(redirect.lastUrl as string);
    const redirectState = signingUrl.searchParams.get('state');
    expect(redirectState).toBeTruthy();
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw as string) as PersistedSnapshot;
    expect(snapshot.flowSlug).toBe('bank');
    expect(snapshot.state).toBe(redirectState);

    // PHASE B: simulate the approved callback through FlowResume, then mount a fresh
    // bank-flow (its constructor reads FlowResume.pending) → resume → 200 → receipt.
    const resumeSvc = TestBed.inject(FlowResume);
    const slug = resumeSvc.consume(
      { get: (k) => ({ mitid: 'callback', flow: 'bank', status: 'approved', state: redirectState!, code: 'otc-test' } as Record<string, string>)[k] ?? null },
      () => 1,
    );
    expect(slug).toBe('bank');

    const fixtureB = TestBed.createComponent(BankFlow);
    fixtureB.detectChanges();
    await new Promise((r) => setTimeout(r, 1300)); // loadOptions(500) + submit(500) real delays
    await fixtureB.whenStable();
    fixtureB.detectChanges();

    const text = (fixtureB.nativeElement as HTMLElement).textContent ?? '';
    // CPR 0101010001 → challengeId bank-0001 → confirmationId BANK-bank-0001.
    expect(text).toContain('BANK-bank-0001');
  });
});
