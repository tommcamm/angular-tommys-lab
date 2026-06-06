import { ChangeDetectionStrategy, Component, output, signal } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { REPO_URL, groupExperiments } from '../experiments';
import { GithubIcon } from './github-icon';

/** Brand + collapsible grouped experiment nav. Rendered in the desktop sidebar
 *  and inside the mobile drawer; emits `navigate` so the drawer can close. */
@Component({
  selector: 'tommy-side-nav',
  imports: [RouterLink, RouterLinkActive, GithubIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="brand" routerLink="/" (click)="navigate.emit()">
      🧪 Tommy's Angular Lab
    </a>

    <nav>
      @for (group of groups; track group.name) {
        <div class="group">
          <button
            type="button"
            class="group-heading"
            [attr.aria-expanded]="isOpen(group.name)"
            (click)="toggleGroup(group.name)"
          >
            <span class="caret" [class.open]="isOpen(group.name)">▸</span>
            {{ group.name }}
          </button>
          @if (isOpen(group.name)) {
            <div class="group-items">
              @for (exp of group.experiments; track exp.slug) {
                <a
                  class="nav-link"
                  [routerLink]="exp.slug"
                  routerLinkActive="active"
                  (click)="navigate.emit()"
                >
                  {{ exp.title }}
                </a>
              }
            </div>
          }
        </div>
      } @empty {
        <p class="nav-empty">None yet</p>
      }
    </nav>

    <a
      class="repo-link"
      [href]="repoUrl"
      target="_blank"
      rel="noopener"
      aria-label="View this project on GitHub"
    >
      <tommy-github-icon />
      <span>Source on GitHub</span>
    </a>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
      height: 100%;
      padding: 1.5rem 1rem;
      color: var(--sidebar-text);
    }
    .brand {
      font-size: 1.05rem;
      font-weight: 700;
      color: var(--sidebar-text-strong);
      text-decoration: none;
    }
    nav { display: flex; flex-direction: column; gap: 0.75rem; }
    .group-heading {
      display: flex;
      align-items: center;
      gap: 0.4rem;
      width: 100%;
      padding: 0.25rem 0.5rem;
      background: none;
      border: 0;
      color: var(--sidebar-muted);
      font: inherit;
      font-size: 0.7rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }
    .caret { transition: transform 0.15s; }
    .caret.open { transform: rotate(90deg); }
    .group-items { display: flex; flex-direction: column; gap: 0.125rem; }
    .nav-link {
      padding: 0.5rem 0.625rem;
      border-radius: 0.5rem;
      color: var(--sidebar-text);
      text-decoration: none;
      font-size: 0.9rem;
    }
    .nav-link:hover { background: var(--sidebar-hover); color: #fff; }
    .nav-link.active {
      background: var(--sidebar-active-bg);
      color: var(--sidebar-active-fg);
    }
    .nav-empty { padding: 0 0.625rem; color: var(--sidebar-muted); font-size: 0.85rem; }
    .repo-link {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      margin-top: auto;
      padding-top: 1rem;
      border-top: 1px solid var(--sidebar-border);
      color: var(--sidebar-muted);
      text-decoration: none;
      font-size: 0.85rem;
    }
    .repo-link:hover { color: #fff; }
  `,
})
export class SideNav {
  /** Emitted on brand/link click so a parent drawer can close itself. */
  readonly navigate = output<void>();

  protected readonly groups = groupExperiments();
  protected readonly repoUrl = REPO_URL;

  /** Set of collapsed group names (absent ⇒ open). */
  private readonly collapsed = signal<ReadonlySet<string>>(new Set<string>());

  protected isOpen(group: string): boolean {
    return !this.collapsed().has(group);
  }

  protected toggleGroup(group: string): void {
    this.collapsed.update((set) => {
      const next = new Set(set);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  }
}
