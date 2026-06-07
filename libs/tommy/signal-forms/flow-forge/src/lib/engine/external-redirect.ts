import { Injectable } from '@angular/core';

/**
 * Injectable seam over `window.location.href =`. Tests substitute a fake so they
 * never actually navigate. Also exposes the current origin for return-URL building.
 */
@Injectable({ providedIn: 'root' })
export class ExternalRedirect {
  get origin(): string {
    return window.location.origin;
  }
  to(url: string): void {
    window.location.href = url;
  }
}
