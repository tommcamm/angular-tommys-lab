import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { QUERY, Redirect } from './redirect';

/** Origins this mock IdP is allowed to return users to (no open redirect). */
const ALLOWED_RETURN_ORIGINS = ['http://localhost:4200'];

@Component({
  selector: 'tommy-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="idp">
      <h1>MitID <span class="mock">(mock)</span></h1>
      @if (invalid()) {
        <p class="err">Invalid sign-in request.</p>
      } @else {
        <p>
          Authorize signing for challenge <strong>{{ challenge() }}</strong
          >?
        </p>
        <div class="row">
          <button type="button" class="approve" (click)="approve()">
            Approve & sign
          </button>
          <button type="button" class="cancel" (click)="cancel()">Cancel</button>
        </div>
      }
    </main>
  `,
  styles: [
    `
      .idp {
        max-width: 28rem;
        margin: 4rem auto;
        font-family: system-ui, sans-serif;
        text-align: center;
      }
      h1 {
        color: #0a3d91;
      }
      .mock {
        color: #888;
        font-size: 0.6em;
      }
      .row {
        display: flex;
        gap: 0.75rem;
        justify-content: center;
        margin-top: 1.5rem;
      }
      button {
        padding: 0.6rem 1rem;
        border-radius: 8px;
        border: 1px solid #ccc;
        cursor: pointer;
      }
      .approve {
        background: #0a3d91;
        color: #fff;
        border-color: #0a3d91;
      }
      .err {
        color: #b00;
      }
    `,
  ],
})
export class App {
  private readonly redirect = inject(Redirect);
  private readonly injectedQuery = inject(QUERY, { optional: true });

  protected readonly challenge = signal('');
  private readonly state: string;
  private readonly returnUrl: string;
  protected readonly invalid = computed(() => !this.returnAllowed());

  constructor() {
    const params = new URLSearchParams(
      this.injectedQuery ?? window.location.search,
    );
    this.challenge.set(params.get('challenge') ?? '');
    this.state = params.get('state') ?? '';
    this.returnUrl = params.get('return') ?? '';
  }

  private returnAllowed(): boolean {
    try {
      return ALLOWED_RETURN_ORIGINS.includes(new URL(this.returnUrl).origin);
    } catch {
      return false;
    }
  }

  approve(): void {
    if (!this.returnAllowed()) return;
    const u = new URL(this.returnUrl);
    u.searchParams.set('status', 'approved');
    u.searchParams.set('state', this.state);
    u.searchParams.set('code', crypto.randomUUID());
    this.redirect.go(u.toString());
  }

  cancel(): void {
    if (!this.returnAllowed()) return;
    const u = new URL(this.returnUrl);
    u.searchParams.set('status', 'cancelled');
    u.searchParams.set('state', this.state);
    this.redirect.go(u.toString());
  }
}
