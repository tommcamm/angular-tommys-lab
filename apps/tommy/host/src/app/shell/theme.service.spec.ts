import { TestBed } from '@angular/core/testing';
import { ThemeService } from './theme.service';

describe('ThemeService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('defaults to light when nothing is stored', () => {
    expect(TestBed.inject(ThemeService).theme()).toBe('light');
  });

  it('reads a stored theme', () => {
    localStorage.setItem('tommy-lab-theme', 'dark');
    expect(TestBed.inject(ThemeService).theme()).toBe('dark');
  });

  it('toggle flips the theme, writes data-theme, and persists', () => {
    const svc = TestBed.inject(ThemeService);
    svc.toggle();
    expect(svc.theme()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem('tommy-lab-theme')).toBe('dark');
    svc.toggle();
    expect(svc.theme()).toBe('light');
    expect(localStorage.getItem('tommy-lab-theme')).toBe('light');
  });
});
