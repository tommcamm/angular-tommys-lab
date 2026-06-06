import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { EXPERIMENTS, sourceUrl } from '../experiments';

describe('Home', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Home],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders grouped cards with badges and source links', () => {
    const f = TestBed.createComponent(Home);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;

    expect(el.querySelector('.group-title')?.textContent?.trim()).toBe(
      'Signal Forms',
    );
    expect(el.querySelectorAll('.card').length).toBe(EXPERIMENTS.length);

    const totalTags = EXPERIMENTS.reduce((n, e) => n + e.tags.length, 0);
    expect(el.querySelectorAll('.badge').length).toBe(totalTags);

    const firstSource = el.querySelector<HTMLAnchorElement>('.source');
    expect(firstSource?.getAttribute('href')).toBe(sourceUrl(EXPERIMENTS[0]));
    expect(firstSource?.getAttribute('target')).toBe('_blank');
  });
});
