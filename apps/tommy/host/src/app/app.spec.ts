import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { EXPERIMENTS } from './experiments';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders a sidebar nav link for every registered experiment', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    await fixture.whenStable();

    const links =
      fixture.nativeElement.querySelectorAll<HTMLAnchorElement>('.nav-link');
    expect(links.length).toBe(EXPERIMENTS.length);
    expect(links[0].textContent?.trim()).toBe(EXPERIMENTS[0].title);
  });

  it('hosts the command palette and action bar', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tommy-action-bar')).toBeTruthy();
    expect(el.querySelector('tommy-command-palette')).toBeTruthy();
  });

  // jsdom can't compute styles from external CSS, so we guard the source: the
  // forced-light experiment surface must reset color-scheme, otherwise the dark
  // root makes the browser paint native form controls dark on the white card.
  it('forces a light color-scheme on the experiment surface', () => {
    // Vitest's cwd is this project's root (vite `root: __dirname`).
    const css = readFileSync(join(process.cwd(), 'src/app/app.css'), 'utf8');
    const start = css.indexOf('.main.surface-host');
    expect(start).toBeGreaterThanOrEqual(0);
    const rule = css.slice(start, css.indexOf('}', start));
    expect(rule).toContain('color-scheme: light');
  });
});
