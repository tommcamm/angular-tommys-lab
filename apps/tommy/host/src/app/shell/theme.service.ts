import { Injectable, signal } from '@angular/core';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'tommy-lab-theme';

function readStored(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function prefersDark(): boolean {
  try {
    return (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );
  } catch {
    return false;
  }
}

function initialTheme(): Theme {
  return readStored() ?? (prefersDark() ? 'dark' : 'light');
}

/**
 * Holds the active theme as a signal and mirrors it to `<html data-theme>` +
 * `localStorage`. Applied imperatively (not via `effect`) so DOM/storage writes
 * are synchronous and trivially testable. The token CSS in `styles.css` does the
 * rest. A matching inline script in `index.html` prevents a first-paint flash.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<Theme>(initialTheme());

  constructor() {
    this.apply(this.theme());
  }

  toggle(): void {
    this.set(this.theme() === 'light' ? 'dark' : 'light');
  }

  set(theme: Theme): void {
    this.theme.set(theme);
    this.apply(theme);
  }

  private apply(theme: Theme): void {
    document.documentElement.dataset['theme'] = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch (e) {
      // Non-fatal: storage may be unavailable (private mode/quota). The
      // in-memory signal + data-theme attribute still drive the UI.
      void e;
    }
  }
}
