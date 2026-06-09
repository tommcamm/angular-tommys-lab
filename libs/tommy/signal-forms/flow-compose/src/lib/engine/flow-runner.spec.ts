import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { TestHost } from './testing/test-host';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';
import { ExternalRedirect } from './external-redirect';
import { FlowStateStore } from './flow-state-store';

class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'https://lab.example';
  to(url: string): void { this.lastUrl = url; }
}

function configure(submit: FlowFixture['submit'], redirect = new FakeRedirect()) {
  TestBed.configureTestingModule({
    imports: [TestHost],
    providers: [
      FlowBackend, FlowStateStore,
      { provide: ExternalRedirect, useValue: redirect },
      { provide: FLOW_FIXTURES, useValue: new Map<string, FlowFixture>([['test', { features: {}, terms: {}, submit }]]) },
    ],
  });
  const fixture = TestBed.createComponent(TestHost);
  fixture.detectChanges();
  return { fixture, redirect };
}

const OK: FlowFixture['submit'] = () => ({ status: 'ok', httpStatus: 200, confirmationId: 'OK-9' } as const);

function clickByText(fixture: ComponentFixture<TestHost>, text: string): void {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find((b) => (b.textContent ?? '').trim() === text || (b.textContent ?? '').includes(text));
  if (!btn) throw new Error(`button not found: ${text}`);
  btn.click();
  fixture.detectChanges();
}
function setInput(fixture: ComponentFixture<TestHost>, selector: string, value: string): void {
  const input = (fixture.nativeElement as HTMLElement).querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}
async function clickSubmit(fixture: ComponentFixture<TestHost>): Promise<void> {
  clickByText(fixture, 'Submit');
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('FlowRunner — phases & gate', () => {
  afterEach(() => sessionStorage.clear());

  it('renders the flowIntro body in the intro phase', () => {
    const { fixture } = configure(OK);
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('intro copy');
  });

  it('Start (form ready) shows the first step; Start is disabled while form is undefined', () => {
    const { fixture } = configure(OK);
    fixture.componentInstance.formReady.set(false);
    fixture.detectChanges();
    const start = (fixture.nativeElement as HTMLElement).querySelector('button');
    expect(start?.hasAttribute('disabled')).toBe(true);
    fixture.componentInstance.formReady.set(true);
    fixture.detectChanges();
    clickByText(fixture, 'Start');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-name')).not.toBeNull();
  });

  it('Next advances when valid; Back returns; Next blocks when invalid', () => {
    const { fixture } = configure(OK);
    clickByText(fixture, 'Start');
    // invalid → blocked
    clickByText(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-name')).not.toBeNull();
    // valid → advance
    setInput(fixture, '#t-name', 'Tommy');
    clickByText(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-city')).not.toBeNull();
    clickByText(fixture, 'Back');
    expect((fixture.nativeElement as HTMLElement).querySelector('#t-name')).not.toBeNull();
  });
});

describe('FlowRunner — submit outcomes', () => {
  afterEach(() => sessionStorage.clear());

  async function fillToLast(fixture: ComponentFixture<TestHost>) {
    clickByText(fixture, 'Start');
    setInput(fixture, '#t-name', 'Tommy');
    clickByText(fixture, 'Next');
    setInput(fixture, '#t-city', 'CPH');
  }

  it('200 → done renders the flowReceipt with the confirmation id', async () => {
    const { fixture } = configure(OK);
    await fillToLast(fixture);
    await clickSubmit(fixture);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('All set — OK-9');
  });

  it('422 → inline banner, stays in form (NOT the error page)', async () => {
    const { fixture } = configure(() => ({ status: 'rejected', httpStatus: 422, errors: [{ field: 'x', message: 'Name taken' }] } as const));
    await fillToLast(fixture);
    await clickSubmit(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Name taken');
    expect(el.textContent).not.toContain("We couldn't complete this");
    // No mapServerError → rejection defaults to steps[0] ('one'), so freezeBanner
    // navigates there. The assertion that matters: still on the FORM, not the error page.
    expect(el.querySelector('#t-name')).not.toBeNull();
  });

  it('202 → saves snapshot + redirects same-origin', async () => {
    const { fixture, redirect } = configure(() => ({ status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/sign?c=1', challengeId: 'ch-1' } as const));
    await fillToLast(fixture);
    await clickSubmit(fixture);
    const url = new URL(redirect.lastUrl as string);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('return')).toContain(redirect.origin);
    expect(sessionStorage.getItem('flow-compose:snapshot')).not.toBeNull();
  });
});

describe('FlowRunner — error page', () => {
  afterEach(() => sessionStorage.clear());

  it('loadError → error page (kind load); Try again emits retry + returns to intro', () => {
    const { fixture } = configure(OK);
    fixture.componentInstance.loadError.set('Could not start this flow. Please retry.');
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("We couldn't complete this");
    expect(el.textContent).toContain('Could not start this flow');
    clickByText(fixture, 'Try again');
    expect(fixture.componentInstance.retried()).toBe(true);
    expect(el.textContent).toContain('intro copy'); // back on intro
  });

  it('unexpected submit error → error page (kind submit); Try again returns to the form', async () => {
    const { fixture } = configure(() => { throw new Error('boom'); });
    clickByText(fixture, 'Start');
    setInput(fixture, '#t-name', 'Tommy');
    clickByText(fixture, 'Next');
    setInput(fixture, '#t-city', 'CPH');
    await clickSubmit(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain("We couldn't complete this");
    clickByText(fixture, 'Try again');
    expect(el.querySelector('#t-city')).not.toBeNull(); // back on the form
  });
});

describe('FlowRunner — resume', () => {
  afterEach(() => sessionStorage.clear());

  it('with [resume] set + form ready, jumps to the last step and re-submits → done', async () => {
    const submit: FlowFixture['submit'] = (_p, sig) =>
      sig ? ({ status: 'ok', httpStatus: 200, confirmationId: 'SIGNED-1' } as const)
          : ({ status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/x', challengeId: 'c' } as const);
    const { fixture } = configure(submit);
    // A real flow component restores the persisted (valid) model from the snapshot
    // before the runner re-submits; mirror that so the last-step gate passes.
    fixture.componentInstance.model.set({ one: { name: 'Tom' }, two: { city: 'CPH' } });
    fixture.componentInstance.resume.set({ challengeId: 'c', code: 'otc-1' });
    fixture.detectChanges();
    await new Promise((r) => setTimeout(r, 700)); // submit(500) real delay
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('All set — SIGNED-1');
  });
});
