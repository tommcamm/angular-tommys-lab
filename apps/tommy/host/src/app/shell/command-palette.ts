import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { type Experiment, groupExperiments } from '../experiments';

/** ⌘K overlay: registry-driven, keyboard-navigable experiment switcher. The
 *  global shortcut is owned by `App`, which calls `toggle()`/`openPalette()`. */
@Component({
  selector: 'tommy-command-palette',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (open()) {
      <button class="backdrop" type="button" aria-label="Close" (click)="close()"></button>
      <div class="palette" role="dialog" aria-modal="true" aria-label="Search experiments">
        <input
          #search
          class="palette-input"
          type="text"
          placeholder="Search experiments…"
          [value]="query()"
          (input)="onInput($event)"
          (keydown)="onKeydown($event)"
        />
        <div class="results">
          @for (group of results(); track group.name) {
            <p class="result-heading">{{ group.name }}</p>
            @for (exp of group.experiments; track exp.slug) {
              <button
                type="button"
                class="result"
                [class.active]="exp.slug === activeSlug()"
                (mouseenter)="setActive(exp.slug)"
                (click)="choose(exp)"
              >
                <span>{{ exp.title }}</span>
                <span class="hint">↵</span>
              </button>
            }
          } @empty {
            <p class="empty">No experiments match "{{ query() }}".</p>
          }
        </div>
        <div class="footer">↑↓ navigate · ↵ open · esc close</div>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      display: block;
      margin: 0;
      padding: 0;
      border: 0;
      background: rgba(1, 4, 9, 0.55);
      cursor: pointer;
      z-index: 40;
    }
    .palette {
      position: fixed;
      top: 12vh;
      left: 50%;
      transform: translateX(-50%);
      width: min(34rem, calc(100vw - 2rem));
      background: var(--surface);
      color: var(--text);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      box-shadow: 0 24px 60px rgba(1, 4, 9, 0.45);
      overflow: hidden;
      z-index: 41;
    }
    .palette-input {
      width: 100%;
      box-sizing: border-box;
      padding: 0.9rem 1rem;
      border: 0;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
      font: inherit;
      font-size: 1rem;
      outline: none;
    }
    .results { max-height: 50vh; overflow: auto; padding: 0.375rem; }
    .result-heading {
      margin: 0.375rem 0.25rem 0.125rem;
      font-size: 0.65rem;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--text-muted);
    }
    .result {
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: 100%;
      padding: 0.6rem 0.7rem;
      border: 0;
      border-radius: 0.5rem;
      background: none;
      color: var(--text);
      font: inherit;
      font-size: 0.9rem;
      text-align: left;
      cursor: pointer;
    }
    .result.active { background: var(--accent-soft); color: var(--accent); }
    .result .hint { font-size: 0.75rem; color: var(--text-muted); }
    .empty { padding: 1rem; color: var(--text-muted); }
    .footer {
      border-top: 1px solid var(--border);
      padding: 0.5rem 0.8rem;
      font-size: 0.7rem;
      color: var(--text-muted);
    }
  `,
})
export class CommandPalette {
  private readonly router = inject(Router);
  private readonly searchInput =
    viewChild<ElementRef<HTMLInputElement>>('search');
  private trigger: HTMLElement | null = null;

  readonly open = signal(false);
  protected readonly query = signal('');
  protected readonly activeIndex = signal(0);

  protected readonly results = computed(() => {
    const q = this.query().trim().toLowerCase();
    const groups = groupExperiments();
    if (!q) return groups;
    return groups
      .map((g) => ({
        name: g.name,
        experiments: g.experiments.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            e.group.toLowerCase().includes(q) ||
            e.tags.some((t) => t.toLowerCase().includes(q)),
        ),
      }))
      .filter((g) => g.experiments.length > 0);
  });

  private readonly flat = computed(() =>
    this.results().flatMap((g) => [...g.experiments]),
  );

  protected readonly activeSlug = computed(() => {
    const items = this.flat();
    if (items.length === 0) return null;
    return items[Math.min(this.activeIndex(), items.length - 1)].slug;
  });

  openPalette(): void {
    this.trigger = document.activeElement as HTMLElement | null;
    this.query.set('');
    this.activeIndex.set(0);
    this.open.set(true);
    queueMicrotask(() => this.searchInput()?.nativeElement.focus());
  }

  close(): void {
    this.open.set(false);
    this.trigger?.focus();
    this.trigger = null;
  }

  toggle(): void {
    if (this.open()) {
      this.close();
    } else {
      this.openPalette();
    }
  }

  protected onInput(e: Event): void {
    this.query.set((e.target as HTMLInputElement).value);
    this.activeIndex.set(0);
  }

  protected setActive(slug: string): void {
    const idx = this.flat().findIndex((e) => e.slug === slug);
    if (idx >= 0) this.activeIndex.set(idx);
  }

  protected choose(exp: Experiment): void {
    this.close();
    this.router.navigate([exp.slug]);
  }

  protected onKeydown(e: KeyboardEvent): void {
    const items = this.flat();
    switch (e.key) {
      case 'Escape':
        this.close();
        return;
      case 'ArrowDown':
        if (items.length) {
          e.preventDefault();
          this.activeIndex.update((i) => Math.min(i + 1, items.length - 1));
        }
        return;
      case 'ArrowUp':
        if (items.length) {
          e.preventDefault();
          this.activeIndex.update((i) => Math.max(i - 1, 0));
        }
        return;
      case 'Enter': {
        e.preventDefault();
        const sel = items[Math.min(this.activeIndex(), items.length - 1)];
        if (sel) this.choose(sel);
        return;
      }
    }
  }
}
