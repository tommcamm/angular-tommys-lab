import { TestBed } from '@angular/core/testing';
import { FlowService } from './flow.service';
import type { FlowSubmission } from './flow-options';

function submission(
  over: Partial<FlowSubmission['account']> = {},
): FlowSubmission {
  return {
    profile: { firstName: 'Tommy', lastName: 'C', email: 'tommy@example.com' },
    account: { username: 'tommy123', password: 'super-secret', ...over },
    acceptedTosIds: ['privacy', 'terms'],
  };
}

describe('FlowService (simulated backend)', () => {
  let service: FlowService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [FlowService] });
    service = TestBed.inject(FlowService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads options with the configured constraints and required/optional TOS', async () => {
    const p = service.loadOptions();
    await vi.runAllTimersAsync();
    const opts = await p;

    expect(opts.username.minLength).toBe(4);
    expect(opts.username.maxLength).toBe(20);
    expect(opts.password.minLength).toBe(8);
    expect(opts.tos.some((t) => t.required)).toBe(true);
    expect(opts.tos.some((t) => !t.required)).toBe(true);
  });

  it('rejects the reserved username "taken" (case-insensitive) with a username field error', async () => {
    const p = service.submitFlow(submission({ username: 'Taken' }));
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res.ok).toBe(false);
    if (res.ok)
      throw new Error('expected submitFlow to fail for username "taken"');
    expect(res.fieldErrors[0].field).toBe('username');
  });

  it('succeeds with a confirmation id otherwise', async () => {
    const p = service.submitFlow(submission({ username: 'tommy123' }));
    await vi.runAllTimersAsync();
    const res = await p;

    expect(res.ok).toBe(true);
    if (!res.ok) throw new Error('expected submitFlow to succeed');
    expect(res.confirmationId).toContain('tommy123');
  });
});
