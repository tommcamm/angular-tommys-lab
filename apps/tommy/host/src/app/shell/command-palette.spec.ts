import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { CommandPalette } from './command-palette';

describe('CommandPalette', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CommandPalette],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  function make() {
    const f = TestBed.createComponent(CommandPalette);
    f.detectChanges();
    return f;
  }

  it('is closed initially and opens/closes', () => {
    const f = make();
    expect(f.componentInstance.open()).toBe(false);
    f.componentInstance.openPalette();
    expect(f.componentInstance.open()).toBe(true);
    f.componentInstance.close();
    expect(f.componentInstance.open()).toBe(false);
  });

  it('filters experiments by query (title/tag/group)', () => {
    const f = make();
    const c = f.componentInstance as unknown as {
      query: { set: (v: string) => void };
      results: () => { experiments: { slug: string }[] }[];
    };
    c.query.set('wizard');
    const slugs = c.results().flatMap((g) => g.experiments.map((e) => e.slug));
    expect(slugs).toEqual(['multi-step-form']);

    c.query.set('multi'); // matches the 'multi-step' tag (wizard + flow-forge + flow-compose)
    expect(
      c.results().flatMap((g) => g.experiments.map((e) => e.slug)),
    ).toEqual(['multi-step-form', 'flow-forge', 'flow-compose']);
  });

  it('Enter routes to the active experiment and closes', () => {
    const f = make();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const c = f.componentInstance as unknown as {
      query: { set: (v: string) => void };
      onKeydown: (e: KeyboardEvent) => void;
    };
    f.componentInstance.openPalette();
    c.query.set('wizard');
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navSpy).toHaveBeenCalledWith(['multi-step-form']);
    expect(f.componentInstance.open()).toBe(false);
  });

  it('Escape closes', () => {
    const f = make();
    f.componentInstance.openPalette();
    (
      f.componentInstance as unknown as { onKeydown: (e: KeyboardEvent) => void }
    ).onKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(f.componentInstance.open()).toBe(false);
  });

  it('ArrowDown moves the active item, then Enter opens it', () => {
    const f = make();
    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const c = f.componentInstance as unknown as {
      onKeydown: (e: KeyboardEvent) => void;
    };
    f.componentInstance.openPalette(); // empty query → all experiments, active = first
    c.onKeydown(new KeyboardEvent('keydown', { key: 'ArrowDown' })); // → second
    c.onKeydown(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(navSpy).toHaveBeenCalledWith(['multi-step-form']);
    expect(f.componentInstance.open()).toBe(false);
  });

  it('focuses the search input on open so the keyboard works immediately', async () => {
    const f = TestBed.createComponent(CommandPalette);
    document.body.appendChild(f.nativeElement);
    try {
      f.componentInstance.openPalette();
      await f.whenStable();
      const input = f.nativeElement.querySelector('.palette-input');
      expect(input).toBeTruthy();
      expect(document.activeElement).toBe(input);
    } finally {
      f.destroy();
      f.nativeElement.remove();
    }
  });

  it('toggle alternates the open state', () => {
    const f = make();
    expect(f.componentInstance.open()).toBe(false);
    f.componentInstance.toggle();
    expect(f.componentInstance.open()).toBe(true);
    f.componentInstance.toggle();
    expect(f.componentInstance.open()).toBe(false);
  });
});
