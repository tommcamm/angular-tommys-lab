import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { FlowRunner } from './flow-runner';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './flow-backend';
import { testFlow } from './testing/test-flow';

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

  it('renders the step indicator and error banner host within the form phase', async () => {
    const fixture = await setup();
    const el = fixture.nativeElement as HTMLElement;
    await start(fixture);

    expect(el.querySelector('tommy-step-indicator')).not.toBeNull();
    expect(el.querySelector('tommy-error-banner')).not.toBeNull();
  });
});
