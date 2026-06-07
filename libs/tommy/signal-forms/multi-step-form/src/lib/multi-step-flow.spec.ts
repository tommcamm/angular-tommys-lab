import { vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { MultiStepFlow } from './multi-step-flow';
import { FlowService } from './model/flow.service';
import type {
  FlowOptions,
  FlowSubmission,
  SubmitResult,
} from './model/flow-options';

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
        fieldErrors: [
          { field: 'username', message: 'That username is already taken' },
        ],
      });
    }
    return Promise.resolve({
      ok: true,
      confirmationId: `SIGNUP-${submission.account.username}`,
    });
  }
}

function setInput(
  fixture: ComponentFixture<MultiStepFlow>,
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
  fixture: ComponentFixture<MultiStepFlow>,
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

async function startFlow(): Promise<ComponentFixture<MultiStepFlow>> {
  const fixture = TestBed.createComponent(MultiStepFlow);
  fixture.detectChanges();
  clickButton(fixture, 'Start');
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

// Fills profile + account so the first two steps are valid and we're on the TOS step.
async function fillThroughTos(
  fixture: ComponentFixture<MultiStepFlow>,
  username: string,
): Promise<void> {
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
    TestBed.configureTestingModule({
      imports: [MultiStepFlow],
    }).overrideComponent(MultiStepFlow, {
      set: { providers: [{ provide: FlowService, useValue: stub }] },
    });
  });

  it('shows the intro, then advances to the profile step after Start', async () => {
    const fixture = await startFlow();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'First name',
    );
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
    // ...and inline on the username field (the reason the account subtree is reset).
    const usernameError = el
      .querySelector('#ms-username')!
      .closest('.ui-field')!
      .querySelector('.ui-error');
    expect(usernameError?.textContent).toContain('already taken');
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

  it('keeps the banner frozen while editing; it clears and advances only on Next', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next'); // reveal errors on the (empty) profile step
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')).not.toBeNull();

    // Filling the fields does NOT move the banner — it is frozen until Next.
    setInput(fixture, '#ms-firstName', 'Tommy');
    setInput(fixture, '#ms-lastName', 'C');
    setInput(fixture, '#ms-email', 'tommy@example.com');
    expect(el.querySelector('[role=alert]')).not.toBeNull();

    // Pressing Next now: the step is valid → banner clears AND we advance.
    clickButton(fixture, 'Next');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Username',
    );
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role=alert]'),
    ).toBeNull();
  });

  it('on the last step, Submit reveals the banner and does not submit when a required item is unaccepted', async () => {
    const fixture = await startFlow();
    setInput(fixture, '#ms-firstName', 'Tommy');
    setInput(fixture, '#ms-lastName', 'C');
    setInput(fixture, '#ms-email', 'tommy@example.com');
    clickButton(fixture, 'Next');
    setInput(fixture, '#ms-username', 'tommy123');
    setInput(fixture, '#ms-password', 'super-secret');
    setInput(fixture, '#ms-confirm', 'super-secret');
    clickButton(fixture, 'Next');
    // Now on the TOS step with the required checkbox unaccepted.
    clickButton(fixture, 'Submit');

    const el = fixture.nativeElement as HTMLElement;
    const alert = el.querySelector('[role=alert]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('You must accept this to continue');
    expect(el.textContent).not.toContain('All set'); // did not submit
  });

  it('shows a standalone error message (not the banner) when submit throws unexpectedly', async () => {
    stub.submitFlow = () => Promise.reject(new Error('network down'));
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'tommy123');

    clickButton(fixture, 'Submit');
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('An unexpected error occurred'); // standalone submitError paragraph
    expect(el.textContent).toContain('Username'); // returned to the account step
  });

  it('clears a field inline error on edit and does not re-show it until the next Next', async () => {
    const fixture = await startFlow();
    clickButton(fixture, 'Next'); // reveal inline errors on the empty profile
    const el = fixture.nativeElement as HTMLElement;
    const firstNameError = () =>
      el
        .querySelector('#ms-firstName')!
        .closest('.ui-field')!
        .querySelector('.ui-error');

    expect(firstNameError()).not.toBeNull();

    // Start typing → that field's inline error clears.
    setInput(fixture, '#ms-firstName', 'T');
    expect(firstNameError()).toBeNull();

    // Going invalid again (cleared) does NOT re-show it — only a Next press does.
    setInput(fixture, '#ms-firstName', '');
    expect(firstNameError()).toBeNull();

    clickButton(fixture, 'Next');
    expect(firstNameError()).not.toBeNull();
  });

  it('disables Start and shows a spinner while loading, then advances', async () => {
    let resolveOpts!: (o: FlowOptions) => void;
    stub.loadOptions = () =>
      new Promise<FlowOptions>((r) => {
        resolveOpts = r;
      });
    const fixture = TestBed.createComponent(MultiStepFlow);
    fixture.detectChanges();
    clickButton(fixture, 'Start');

    const el = fixture.nativeElement as HTMLElement;
    const startBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Starting'),
    );
    expect(startBtn?.disabled).toBe(true);
    expect(el.querySelector('.ui-spinner')).not.toBeNull();
    expect(el.textContent).toContain('Create your account'); // still on intro

    resolveOpts(OPTS);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('First name');
  });

  it('Back on the profile step returns to intro and resumes with data preserved', async () => {
    const fixture = await startFlow();
    setInput(fixture, '#ms-firstName', 'Tommy');

    clickButton(fixture, 'Back');
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Create your account'); // intro

    const spy = vi.spyOn(stub, 'loadOptions');
    clickButton(fixture, 'Start');
    await fixture.whenStable();
    fixture.detectChanges();

    expect(el.textContent).toContain('First name'); // resumed on profile
    expect(
      (el.querySelector('#ms-firstName') as HTMLInputElement).value,
    ).toBe('Tommy'); // data preserved
    expect(spy).not.toHaveBeenCalled(); // no re-fetch
  });

  it('disables Submit and shows a spinner while submitting', async () => {
    let resolveSubmit!: (r: SubmitResult) => void;
    stub.submitFlow = () =>
      new Promise<SubmitResult>((r) => {
        resolveSubmit = r;
      });
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'tommy123');

    clickButton(fixture, 'Submit');
    const el = fixture.nativeElement as HTMLElement;
    const submitBtn = Array.from(el.querySelectorAll('button')).find((b) =>
      (b.textContent ?? '').includes('Submitting'),
    );
    expect(submitBtn?.disabled).toBe(true);
    expect(el.querySelector('.ui-spinner')).not.toBeNull();

    resolveSubmit({ ok: true, confirmationId: 'SIGNUP-tommy123' });
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.textContent).toContain('All set');
  });

  it('dismisses the standalone submit error after navigating away and back to account', async () => {
    stub.submitFlow = () => Promise.reject(new Error('network down'));
    const fixture = await startFlow();
    await fillThroughTos(fixture, 'tommy123');

    clickButton(fixture, 'Submit');
    await fixture.whenStable();
    await Promise.resolve();
    await fixture.whenStable();
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('An unexpected error occurred'); // on account

    clickButton(fixture, 'Back'); // account → profile (clears the stale error)
    clickButton(fixture, 'Next'); // profile is valid → returns to account
    expect(el.textContent).toContain('Username'); // back on the account step
    expect(el.textContent).not.toContain('An unexpected error occurred');
  });
});
