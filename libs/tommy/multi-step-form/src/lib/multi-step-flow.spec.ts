import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MultiStepFlow } from './multi-step-flow';
import { FlowService } from './flow.service';
import type { FlowOptions, FlowSubmission, SubmitResult } from './flow-options';

const OPTS: FlowOptions = {
  username: { minLength: 4, maxLength: 20 },
  password: { minLength: 8 },
  tos: [{ id: 'terms', title: 'Terms', body: 'agree', required: true }],
};

class StubFlowService {
  taken = new Set<string>();
  loadOptions(): Promise<FlowOptions> {
    return Promise.resolve(OPTS);
  }
  submitFlow(submission: FlowSubmission): Promise<SubmitResult> {
    if (this.taken.has(submission.account.username)) {
      return Promise.resolve({
        ok: false,
        fieldErrors: [{ field: 'username', message: 'That username is already taken' }],
      });
    }
    return Promise.resolve({ ok: true, confirmationId: `SIGNUP-${submission.account.username}` });
  }
}

function setInput(fixture: ComponentFixture<MultiStepFlow>, selector: string, value: string): void {
  const el = fixture.nativeElement as HTMLElement;
  const input = el.querySelector<HTMLInputElement>(selector);
  if (!input) throw new Error(`input not found: ${selector}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}

function clickButton(fixture: ComponentFixture<MultiStepFlow>, label: string): void {
  const el = fixture.nativeElement as HTMLElement;
  const btn = Array.from(el.querySelectorAll('button')).find(
    (b) => (b.textContent ?? '').trim() === label,
  );
  if (!btn) throw new Error(`button not found: ${label}`);
  btn.click();
  fixture.detectChanges();
}

async function startFlow(): Promise<ComponentFixture<MultiStepFlow>> {
  const fixture = TestBed.createComponent(MultiStepFlow);
  fixture.detectChanges();
  clickButton(fixture, 'Start');
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

// Fills profile + account so the first two steps are valid and we're on the TOS step.
async function fillThroughTos(fixture: ComponentFixture<MultiStepFlow>, username: string): Promise<void> {
  setInput(fixture, '#ms-firstName', 'Tommy');
  setInput(fixture, '#ms-lastName', 'C');
  setInput(fixture, '#ms-email', 'tommy@example.com');
  clickButton(fixture, 'Next');

  setInput(fixture, '#ms-username', username);
  setInput(fixture, '#ms-password', 'super-secret');
  setInput(fixture, '#ms-confirm', 'super-secret');
  clickButton(fixture, 'Next');

  // Accept the (required) TOS checkbox.
  const el = fixture.nativeElement as HTMLElement;
  const checkbox = el.querySelector<HTMLInputElement>('input[type=checkbox]');
  if (!checkbox) throw new Error('TOS checkbox not found');
  checkbox.checked = true;
  checkbox.dispatchEvent(new Event('change', { bubbles: true }));
  checkbox.dispatchEvent(new Event('input', { bubbles: true }));
  fixture.detectChanges();
}

describe('MultiStepFlow', () => {
  let stub: StubFlowService;

  beforeEach(() => {
    stub = new StubFlowService();
    TestBed.configureTestingModule({ imports: [MultiStepFlow] }).overrideComponent(MultiStepFlow, {
      set: { providers: [{ provide: FlowService, useValue: stub }] },
    });
  });

  it('shows the intro, then advances to the profile step after Start', async () => {
    const fixture = await startFlow();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('First name');
  });

  it('completes the happy path and shows a confirmation id', async () => {
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'tommy123');

    clickButton(fixture, 'Submit');
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('All set');
    expect(text).toContain('SIGNUP-tommy123');
  });

  it('surfaces a server "username taken" error on the account step', async () => {
    stub.taken.add('taken');
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'taken');

    clickButton(fixture, 'Submit');
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Username'); // back on the account step
    const alert = el.querySelector('[role=alert]');
    expect(alert?.textContent).toContain('already taken'); // surfaced via the banner
  });

  it('does not show errors or the banner on blur, before Next is pressed', async () => {
    const fixture = await startFlow();
    const el = fixture.nativeElement as HTMLElement;
    const firstName = el.querySelector<HTMLInputElement>('#ms-firstName');
    firstName?.dispatchEvent(new Event('blur', { bubbles: true }));
    fixture.detectChanges();
    expect(el.querySelector('.ui-error')).toBeNull();
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('reveals the banner + inline errors when Next is clicked on an invalid step, and stays put', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('First name'); // still on the profile step
    const alert = el.querySelector('[role=alert]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('First name is required');
    expect(el.querySelectorAll('.ui-error').length).toBeGreaterThan(0);
  });

  it('keeps the Next button enabled even when the step is invalid', async () => {
    const fixture = await startFlow();
    const el = fixture.nativeElement as HTMLElement;
    const next = Array.from(el.querySelectorAll('button')).find(
      (b) => (b.textContent ?? '').trim() === 'Next',
    );
    expect(next).toBeDefined();
    expect(next?.disabled).toBe(false);
  });

  it('clears the banner live once the step becomes valid, then advances', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next'); // reveal errors on the (empty) profile step
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).not.toBeNull();

    setInput(fixture, '#ms-firstName', 'Tommy');
    setInput(fixture, '#ms-lastName', 'C');
    setInput(fixture, '#ms-email', 'tommy@example.com');
    expect((fixture.nativeElement as HTMLElement).querySelector('[role=alert]')).toBeNull();

    clickButton(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Username');
  });
});
