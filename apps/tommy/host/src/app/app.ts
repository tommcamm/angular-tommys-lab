import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { ActionBar } from './shell/action-bar';
import { CommandPalette } from './shell/command-palette';
import { SideNav } from './shell/side-nav';

@Component({
  selector: 'tommy-root',
  imports: [RouterOutlet, SideNav, ActionBar, CommandPalette],
  templateUrl: './app.html',
  styleUrl: './app.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  private readonly router = inject(Router);
  private readonly palette = viewChild.required(CommandPalette);

  protected readonly drawerOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((e) => e instanceof NavigationEnd),
      map(() => this.router.url),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  /** The landing page is the only non-experiment route. */
  protected readonly isHome = computed(() => {
    const u = this.url();
    return u === '/' || u === '';
  });

  protected closeDrawer(): void {
    this.drawerOpen.set(false);
  }

  protected toggleDrawer(): void {
    this.drawerOpen.update((v) => !v);
  }

  protected openSearch(): void {
    this.palette().openPalette();
  }

  @HostListener('document:keydown', ['$event'])
  protected onKeydown(e: KeyboardEvent): void {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.palette().toggle();
    }
  }
}
