import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FlowRunner } from '../../engine/flow-runner';
import { FlowBackend, FLOW_FIXTURES } from '../../engine/flow-backend';
import { ExternalRedirect } from '../../engine/external-redirect';
import { FlowStateStore } from '../../engine/flow-state-store';
import { bankFlow } from './def';
import { bankFixture } from './fixtures';

/**
 * Seam-faked redirect: captures the URL `FlowRunner` would have navigated to (no
 * real cross-origin navigation under jsdom) and reports the host origin used for
 * the same-origin `return` URL. Mirrors the FakeRedirect in flow-runner.spec.ts.
 */
class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'http://localhost:4200';
  to(url: string): void {
    this.lastUrl = url;
  }
}

const SNAPSHOT_KEY = 'flow-forge:snapshot';

function configureBank(redirect: FakeRedirect): void {
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [
      FlowBackend,
      FlowStateStore,
      { provide: ExternalRedirect, useValue: redirect },
      { provide: FLOW_FIXTURES, useValue: new Map([['bank', bankFixture]]) },
    ],
  });
}

/**
 * Click Start and wait past the FlowBackend `loadOptions` delay (real 500ms
 * setTimeout — a single whenStable() doesn't settle it under jsdom). Mirrors the
 * `start()` helper in flow-runner.spec.ts.
 */
async function start(fixture: ComponentFixture<FlowRunner>): Promise<void> {
  const el = fixture.nativeElement as HTMLElement;
  (el.querySelector('button') as HTMLButtonElement).click(); // Start
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

function setInput(
  fixture: ComponentFixture<FlowRunner>,
  selector: string,
  value: string,
): void {
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}

function clickButton(
  fixture: ComponentFixture<FlowRunner>,
  label: string,
): void {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!btn) throw new Error(`button not found: ${label}`);
  btn.click();
  fixture.detectChanges();
}

/** Click a radio input whose `value` attribute equals `value`. */
function pickRadio(fixture: ComponentFixture<FlowRunner>, value: string): void {
  const el = fixture.nativeElement as HTMLElement;
  const radio = Array.from(
    el.querySelectorAll<HTMLInputElement>('input[type=radio]'),
  ).find((r) => r.value === value);
  if (!radio) throw new Error(`radio not found: ${value}`);
  radio.click();
  fixture.detectChanges();
}

/** Check the (single) required TOS checkbox — the first checkbox row (`tos`). */
function acceptFirstTerm(fixture: ComponentFixture<FlowRunner>): void {
  const el = fixture.nativeElement as HTMLElement;
  const box = el.querySelector<HTMLInputElement>('input[type=checkbox]');
  if (!box) throw new Error('TOS checkbox not found');
  box.click();
  fixture.detectChanges();
}

/** Click the Submit button and wait past the FlowBackend submit delay (real 500ms). */
async function clickSubmit(fixture: ComponentFixture<FlowRunner>): Promise<void> {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find((b) =>
    (b.textContent ?? '').includes('Submit'),
  );
  if (!btn) throw new Error('Submit button not found');
  btn.click();
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

/** Start → fill applicant → Next → pick account → Next → accept TOS, landing on the last step. */
async function fillBankToLastStep(
  fixture: ComponentFixture<FlowRunner>,
): Promise<void> {
  await start(fixture);
  setInput(fixture, '#bank-fullName', 'Tommy Tester');
  setInput(fixture, '#bank-cpr', '0101010001');
  clickButton(fixture, 'Next');
  pickRadio(fixture, 'standard');
  clickButton(fixture, 'Next');
  acceptFirstTerm(fixture);
}

interface PersistedSnapshot {
  flowSlug: string;
  schemaVersion: number;
  state: string;
  challengeId: string;
  model: unknown;
}

describe('Bank flow — MitID round-trip (seam-faked integration)', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('submit → 202 (snapshot + redirect) → approved callback → resume → 200 done', async () => {
    // ---- PHASE A: submit → 202 → snapshot saved + redirect captured -------------------
    const redirect = new FakeRedirect();
    configureBank(redirect);
    const fixtureA = TestBed.createComponent(FlowRunner);
    fixtureA.componentRef.setInput('def', bankFlow);
    await fixtureA.whenStable();
    fixtureA.detectChanges();

    await fillBankToLastStep(fixtureA);
    await clickSubmit(fixtureA);

    // The 202 branch must have left for the signing provider via the seam.
    expect(redirect.lastUrl).not.toBeNull();
    const signingUrl = new URL(redirect.lastUrl as string);
    const redirectState = signingUrl.searchParams.get('state');
    expect(redirectState).toBeTruthy();
    expect(signingUrl.searchParams.get('return')).toContain(redirect.origin);

    // A single-use snapshot was persisted for the round-trip. Read it BEFORE consuming
    // (the launcher restore is single-use; this test feeds `resume` to the runner directly).
    const raw = sessionStorage.getItem(SNAPSHOT_KEY);
    expect(raw).not.toBeNull();
    const snapshot = JSON.parse(raw as string) as PersistedSnapshot;
    expect(snapshot.flowSlug).toBe('bank');
    expect(snapshot.state).toBe(redirectState); // the redirect's state matches the snapshot's
    expect(snapshot.challengeId).toBeTruthy();
    expect(snapshot.model).toBeTruthy();

    // ---- PHASE B: approved callback → resume → 200 → done -----------------------------
    // Simulate the provider approving: it returns the matched `state` + a one-time code.
    // The launcher would validate state === snapshot.state, then build ResumeData from
    // the snapshot's model + { challengeId, code }. Here we feed that straight to a runner.
    const code = 'otc-test';
    const resume = {
      model: snapshot.model,
      signature: { challengeId: snapshot.challengeId, code },
    };

    const fixtureB = TestBed.createComponent(FlowRunner);
    fixtureB.componentRef.setInput('def', bankFlow);
    fixtureB.componentRef.setInput('resume', resume);
    fixtureB.detectChanges();

    // resumeAndSubmit re-fetches options (500ms) then re-submits (500ms) — real delays.
    await new Promise((r) => setTimeout(r, 1300));
    await fixtureB.whenStable();
    fixtureB.detectChanges();

    const text = (fixtureB.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('All set');
    // Exact id proves the CPR-derived challengeId survived the whole round-trip:
    // Phase A fills CPR `0101010001` → challengeId `bank-0001` → confirmationId `BANK-bank-0001`.
    expect(text).toContain('BANK-bank-0001');
  });
});
