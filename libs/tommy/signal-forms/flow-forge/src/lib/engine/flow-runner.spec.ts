import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FlowRunner } from './flow-runner';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';
import { ExternalRedirect } from './external-redirect';
import { FlowStateStore } from './flow-state-store';
import { testFlow } from './testing/test-flow';
import type { ResumeData } from './resume';

const fixtures = new Map<string, FlowFixture>([
  [
    'test',
    {
      features: {},
      terms: {},
      submit: () => ({ status: 'ok', httpStatus: 200, confirmationId: 'OK' }),
    },
  ],
]);

async function setup() {
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [FlowBackend, { provide: FLOW_FIXTURES, useValue: fixtures }],
  });
  const fixture = TestBed.createComponent(FlowRunner);
  fixture.componentRef.setInput('def', testFlow);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

/**
 * Click Start and wait for the load to resolve. The FlowBackend `delay()` is a
 * real 500ms `setTimeout`; a single `whenStable()` doesn't settle it under
 * jsdom, so we await a real timeout past it, then re-stabilize + render.
 */
async function start(fixture: ComponentFixture<FlowRunner>): Promise<void> {
  const el = fixture.nativeElement as HTMLElement;
  (el.querySelector('button') as HTMLButtonElement).click(); // Start
  await new Promise((r) => setTimeout(r, 600));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('FlowRunner — rendering & load', () => {
  it('renders the intro from meta', async () => {
    const fixture = await setup();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Test Flow');
    expect(text).toContain('intro copy');
  });

  it('Start loads options and shows the first step', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    await start(fixture);
    expect(el.querySelector('#t-name')).not.toBeNull();
  });

  it('Next advances to the second step; Back returns', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    await start(fixture);

    // Fill step one so Next is allowed to advance.
    const name = el.querySelector<HTMLInputElement>('#t-name');
    if (!name) throw new Error('#t-name not found');
    name.value = 'Tommy';
    name.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();

    const clickButton = (label: string) => {
      const btn = Array.from(el.querySelectorAll('button')).find(
        (b) => (b.textContent ?? '').trim() === label,
      );
      if (!btn) throw new Error(`button not found: ${label}`);
      btn.click();
      fixture.detectChanges();
    };

    clickButton('Next');
    expect(el.querySelector('#t-city')).not.toBeNull();
    expect(el.querySelector('#t-name')).toBeNull();

    clickButton('Back');
    expect(el.querySelector('#t-name')).not.toBeNull();
    expect(el.querySelector('#t-city')).toBeNull();
  });

  it('Next stays on step one when the first step is invalid (empty)', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    await start(fixture);

    // Leave #t-name EMPTY, then click Next: the runner must respect the gate.
    const next = Array.from(el.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === 'Next',
    );
    if (!next) throw new Error('button not found: Next');
    next.click();
    fixture.detectChanges();

    expect(el.querySelector('#t-name')).not.toBeNull();
    expect(el.querySelector('#t-city')).toBeNull();
  });

  it('renders the step indicator and error banner host within the form phase', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    await start(fixture);

    expect(el.querySelector('tommy-step-indicator')).not.toBeNull();
    expect(el.querySelector('tommy-error-banner')).not.toBeNull();
  });
});

// ---- Submit (200 / 422 / 202) ------------------------------------------------------

class FakeRedirect {
  lastUrl: string | null = null;
  origin = 'https://lab.example';
  to(url: string): void {
    this.lastUrl = url;
  }
}

async function setupWith(
  outcome: 'ok' | 'rejected' | 'signing',
): Promise<{ fixture: ComponentFixture<FlowRunner>; redirect: FakeRedirect }> {
  const submit = () =>
    outcome === 'ok'
      ? ({ status: 'ok', httpStatus: 200, confirmationId: 'OK-9' } as const)
      : outcome === 'rejected'
        ? ({
            status: 'rejected',
            httpStatus: 422,
            errors: [{ field: 'one.name', message: 'Name taken' }],
          } as const)
        : ({
            status: 'signing_required',
            httpStatus: 202,
            signingUrl: 'https://idp/sign?challenge=ch-1',
            challengeId: 'ch-1',
          } as const);
  const redirect = new FakeRedirect();
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [
      FlowBackend,
      FlowStateStore,
      { provide: ExternalRedirect, useValue: redirect },
      {
        provide: FLOW_FIXTURES,
        useValue: new Map([['test', { features: {}, terms: {}, submit }]]),
      },
    ],
  });
  const fixture = TestBed.createComponent(FlowRunner);
  fixture.componentRef.setInput('def', testFlow);
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, redirect };
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

/** Start → fill step one (#t-name) → Next → fill step two (#t-city), landing on the last step. */
async function fillToLastStep(
  fixture: ComponentFixture<FlowRunner>,
): Promise<void> {
  await start(fixture);
  setInput(fixture, '#t-name', 'Tommy');
  clickButton(fixture, 'Next');
  setInput(fixture, '#t-city', 'Copenhagen');
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

describe('FlowRunner — submit', () => {
  afterEach(() => sessionStorage.clear());

  it('ok → done with confirmation id', async () => {
    const { fixture } = await setupWith('ok');
    await fillToLastStep(fixture);
    await clickSubmit(fixture);

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('All set');
    expect(text).toContain('OK-9');
  });

  it('signing_required → saves snapshot with state + redirects same-origin', async () => {
    const { fixture, redirect } = await setupWith('signing');
    await fillToLastStep(fixture);
    await clickSubmit(fixture);

    expect(redirect.lastUrl).not.toBeNull();
    const url = new URL(redirect.lastUrl as string);
    expect(url.searchParams.get('state')).toBeTruthy();
    expect(url.searchParams.get('return')).toContain(redirect.origin);

    // A snapshot was persisted for the round-trip (single-use restore, so check storage directly).
    expect(sessionStorage.getItem('flow-forge:snapshot')).not.toBeNull();
  });

  it('rejected → banner shows the mapped message', async () => {
    const { fixture } = await setupWith('rejected');
    await fillToLastStep(fixture);
    await clickSubmit(fixture);

    const el = fixture.nativeElement as HTMLElement;
    const alert = el.querySelector('[role=alert]');
    expect(alert?.textContent).toContain('Name taken');
    expect(el.textContent).not.toContain('All set');
  });
});

// ---- Resume after MitID ------------------------------------------------------------

async function setupResume(resume: ResumeData) {
  const submit = (_p: unknown, signature?: { code: string }) =>
    signature
      ? { status: 'ok', httpStatus: 200, confirmationId: 'SIGNED-1' }
      : { status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/x', challengeId: 'c' };
  TestBed.configureTestingModule({
    imports: [FlowRunner],
    providers: [FlowBackend, FlowStateStore, { provide: FLOW_FIXTURES, useValue: new Map([['test', { features: {}, terms: {}, submit }]]) }],
  });
  const fixture = TestBed.createComponent(FlowRunner);
  fixture.componentRef.setInput('def', testFlow);
  fixture.componentRef.setInput('resume', resume);
  fixture.detectChanges();
  return fixture;
}

describe('FlowRunner — resume after MitID', () => {
  it('rebuilds the form, re-submits with the signature, and lands on done', async () => {
    const fixture = await setupResume({
      model: { one: { name: 'Tom' }, two: { city: 'CPH' } },
      signature: { challengeId: 'c', code: 'otc-1' },
    });
    await new Promise((r) => setTimeout(r, 1300)); // loadOptions(500) + submit(500) real delays
    await fixture.whenStable();
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('All set');
    expect(el.textContent).toContain('SIGNED-1');
  });
});
