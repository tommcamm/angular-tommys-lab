import { Injectable } from '@angular/core';
import type { FlowOptions, FlowSubmission, SubmitResult } from './flow-options';

const DELAY_MS = 600;

function delay<T>(value: T, ms = DELAY_MS): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), ms));
}

/**
 * Stand-in for a real HTTP backend. Deterministic on purpose: the username
 * "taken" is always rejected so the submit() server-error path is testable.
 */
@Injectable()
export class FlowService {
  loadOptions(): Promise<FlowOptions> {
    return delay({
      username: { minLength: 4, maxLength: 20 },
      password: { minLength: 8 },
      tos: [
        {
          id: 'privacy',
          title: 'Privacy Policy',
          body: 'We process your data as described in our policy.',
          required: true,
        },
        {
          id: 'terms',
          title: 'Terms of Service',
          body: 'By creating an account you agree to our terms.',
          required: true,
        },
        {
          id: 'marketing',
          title: 'Product updates',
          body: 'Send me occasional product news (optional).',
          required: false,
        },
      ],
    });
  }

  submitFlow(submission: FlowSubmission): Promise<SubmitResult> {
    if (submission.account.username.trim().toLowerCase() === 'taken') {
      return delay<SubmitResult>({
        ok: false,
        fieldErrors: [
          { field: 'username', message: 'That username is already taken' },
        ],
      });
    }
    return delay<SubmitResult>({
      ok: true,
      confirmationId: `SIGNUP-${submission.account.username}`,
    });
  }
}
