import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Home } from './home';
import { EXPERIMENTS, groupExperiments, sourceUrl, tagVariant } from '../experiments';

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
    const groups = groupExperiments();

    expect(el.querySelectorAll('.group').length).toBe(groups.length);
    expect(el.querySelector('.group-title')?.textContent?.trim()).toBe(
      groups[0].name,
    );
    expect(el.querySelectorAll('.card').length).toBe(EXPERIMENTS.length);

    const totalTags = EXPERIMENTS.reduce((n, e) => n + e.tags.length, 0);
    expect(el.querySelectorAll('.badge').length).toBe(totalTags);

    const firstBadge = el.querySelector<HTMLElement>('.badge');
    expect(firstBadge?.dataset['variant']).toBe(
      tagVariant(EXPERIMENTS[0].tags[0]),
    );

    const firstSource = el.querySelector<HTMLAnchorElement>('.source');
    expect(firstSource?.getAttribute('href')).toBe(sourceUrl(EXPERIMENTS[0]));
    expect(firstSource?.getAttribute('target')).toBe('_blank');
  });
});
