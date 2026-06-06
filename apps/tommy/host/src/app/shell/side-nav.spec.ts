import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SideNav } from './side-nav';
import { EXPERIMENTS, groupExperiments } from '../experiments';

describe('SideNav', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SideNav],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders a heading per group and a link per experiment', () => {
    const f = TestBed.createComponent(SideNav);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.group-heading').length).toBe(
      groupExperiments().length,
    );
    expect(el.querySelectorAll('.nav-link').length).toBe(EXPERIMENTS.length);
    expect(el.querySelector('.nav-link')?.textContent?.trim()).toBe(
      EXPERIMENTS[0].title,
    );
  });

  it('collapses a group when its heading is clicked', () => {
    const f = TestBed.createComponent(SideNav);
    f.detectChanges();
    const el = f.nativeElement as HTMLElement;
    el.querySelector<HTMLButtonElement>('.group-heading')!.click();
    f.detectChanges();
    expect(el.querySelectorAll('.nav-link').length).toBe(0);
  });

  it('emits navigate when a link is clicked', () => {
    const f = TestBed.createComponent(SideNav);
    f.detectChanges();
    const spy = vi.fn();
    f.componentInstance.navigate.subscribe(spy);
    f.nativeElement.querySelector<HTMLAnchorElement>('.nav-link')!.click();
    expect(spy).toHaveBeenCalled();
  });
});
