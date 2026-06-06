import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { REPO_URL } from '../experiments';
import { GithubIcon } from './github-icon';
import { ThemeService } from './theme.service';

/** Sticky top bar: hamburger (mobile), ⌘K search trigger, theme toggle, GitHub. */
@Component({
  selector: 'tommy-action-bar',
  imports: [GithubIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="hamburger"
      aria-label="Open navigation"
      (click)="toggleDrawer.emit()"
    >
      ☰
    </button>

    <button type="button" class="search" (click)="openSearch.emit()">
      <span aria-hidden="true">🔍</span>
      <span class="search-label">Search experiments…</span>
      <kbd>⌘K</kbd>
    </button>

    <span class="spacer"></span>

    <button
      type="button"
      class="icon-btn"
      [attr.aria-label]="
        theme.theme() === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      "
      (click)="theme.toggle()"
    >
      {{ theme.theme() === 'dark' ? '☀' : '☾' }}
    </button>

    <a
      class="icon-btn"
      [href]="repoUrl"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="View this project on GitHub"
    >
      <tommy-github-icon />
    </a>
  `,
  styles: `
    :host {
      position: sticky;
      top: 0;
      z-index: 10;
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.625rem 1rem;
      background: var(--surface);
      border-bottom: 1px solid var(--border);
    }
    .spacer { flex: 1; }
    .hamburger {
      display: none;
      background: none;
      border: 0;
      color: var(--text);
      font-size: 1.25rem;
      cursor: pointer;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      min-width: 0;
      max-width: 22rem;
      flex: 1;
      padding: 0.45rem 0.7rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
      color: var(--text-muted);
      font: inherit;
      font-size: 0.85rem;
      cursor: pointer;
    }
    .search-label { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .search kbd {
      margin-left: auto;
      padding: 0.05rem 0.35rem;
      border: 1px solid var(--border);
      border-radius: 0.25rem;
      background: var(--surface);
      font-size: 0.75rem;
    }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border: 0;
      border-radius: 0.5rem;
      background: none;
      color: var(--text-muted);
      font-size: 1.05rem;
      text-decoration: none;
      cursor: pointer;
    }
    .icon-btn:hover { background: var(--surface-2); color: var(--text); }
    @media (max-width: 768px) {
      .hamburger { display: inline-flex; }
      .search { max-width: none; }
      .search-label,
      .search kbd { display: none; }
    }
  `,
})
export class ActionBar {
  protected readonly theme = inject(ThemeService);
  protected readonly repoUrl = REPO_URL;
  readonly openSearch = output<void>();
  readonly toggleDrawer = output<void>();
}
