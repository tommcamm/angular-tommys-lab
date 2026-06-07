import { Injectable, InjectionToken } from '@angular/core';

/**
 * The raw query string (e.g. `?challenge=...`). Lets unit tests inject a query
 * without touching `window.location`; production falls back to
 * `window.location.search` when this is not provided.
 */
export const QUERY = new InjectionToken<string>('QUERY');

@Injectable({ providedIn: 'root' })
export class Redirect {
  go(url: string): void {
    window.location.href = url;
  }
}
