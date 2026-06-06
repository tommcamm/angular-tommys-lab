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
});
