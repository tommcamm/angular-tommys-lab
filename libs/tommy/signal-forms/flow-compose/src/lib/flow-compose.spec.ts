import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { FlowCompose } from './flow-compose';
import { FlowResume } from './engine/flow-resume';
import { FlowStateStore } from './engine/flow-state-store';

function routeWith(params: Record<string, string>) {
  return { snapshot: { queryParamMap: { get: (k: string) => params[k] ?? null } } } as unknown as ActivatedRoute;
}

describe('FlowCompose launcher', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  it('lists all flow cards in the gallery', () => {
    TestBed.configureTestingModule({
      imports: [FlowCompose],
      providers: [FlowResume, FlowStateStore, { provide: ActivatedRoute, useValue: routeWith({}) }],
    });
    const fixture = TestBed.createComponent(FlowCompose);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-flow=newsletter]')).not.toBeNull();
    expect(el.querySelector('[data-flow=bank]')).not.toBeNull();
    expect(el.querySelector('[data-flow=insurance]')).not.toBeNull();
  });

  it('clicking a card renders that flow component', () => {
    TestBed.configureTestingModule({
      imports: [FlowCompose],
      providers: [FlowResume, FlowStateStore, { provide: ActivatedRoute, useValue: routeWith({}) }],
    });
    const fixture = TestBed.createComponent(FlowCompose);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>('[data-flow=newsletter]')!.click();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).querySelector('tommy-newsletter-flow')).not.toBeNull();
  });

  it('a cancelled MitID callback auto-selects the flow and shows the resubmit notice', () => {
    TestBed.configureTestingModule({
      imports: [FlowCompose],
      providers: [
        FlowResume,
        FlowStateStore,
        {
          provide: ActivatedRoute,
          useValue: routeWith({ mitid: 'callback', flow: 'bank', status: 'cancelled', state: 'st-1' }),
        },
      ],
    });
    // Seed a snapshot so FlowResume.consume finds a matching state.
    TestBed.inject(FlowStateStore).save({
      flowSlug: 'bank',
      schemaVersion: 1,
      state: 'st-1',
      challengeId: 'c',
      model: {},
    });
    const fixture = TestBed.createComponent(FlowCompose);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=status]')?.textContent).toContain('Signing cancelled');
    expect(el.querySelector('tommy-bank-flow')).not.toBeNull();
  });
});
