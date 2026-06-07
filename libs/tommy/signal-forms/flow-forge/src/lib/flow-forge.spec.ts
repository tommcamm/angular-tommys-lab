import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { FlowForge } from './flow-forge';
import { FlowStateStore } from './engine/flow-state-store';

function routeWith(params: Record<string, string>) {
  const map = new Map(Object.entries(params));
  return { snapshot: { queryParamMap: { get: (k: string) => map.get(k) ?? null } } };
}

function mount(route: unknown) {
  TestBed.configureTestingModule({
    imports: [FlowForge],
    providers: [{ provide: ActivatedRoute, useValue: route }],
  });
  const fixture = TestBed.createComponent(FlowForge);
  fixture.detectChanges();
  return fixture;
}

describe('FlowForge launcher', () => {
  beforeEach(() => sessionStorage.clear());

  it('renders a gallery card per flow', () => {
    const fixture = mount(routeWith({}));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Subscribe to the newsletter');
    expect(el.textContent?.toLowerCase()).toContain('minimal'); // dimension badge
  });

  it('selecting a flow mounts the runner', () => {
    const fixture = mount(routeWith({}));
    const el = fixture.nativeElement as HTMLElement;
    (el.querySelector('[data-flow="newsletter"]') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(el.querySelector('tommy-flow-runner')).not.toBeNull();
  });

  it('on a cancelled callback with a matching state, selects the flow + shows a notice', () => {
    // seed a snapshot whose state matches the callback
    const store = new FlowStateStore();
    store.save({ flowSlug: 'newsletter', schemaVersion: 1, state: 'S1', challengeId: 'c', model: {} });
    const fixture = mount(routeWith({ mitid: 'callback', flow: 'newsletter', status: 'cancelled', state: 'S1' }));
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('tommy-flow-runner')).not.toBeNull(); // flow selected
    expect(el.textContent?.toLowerCase()).toContain('cancel'); // notice
  });

  it('ignores a callback whose state does not match the stored snapshot', () => {
    const store = new FlowStateStore();
    store.save({ flowSlug: 'newsletter', schemaVersion: 1, state: 'S1', challengeId: 'c', model: {} });
    const fixture = mount(routeWith({ mitid: 'callback', flow: 'newsletter', status: 'cancelled', state: 'WRONG' }));
    const el = fixture.nativeElement as HTMLElement;
    // not selected → gallery shown, no runner
    expect(el.querySelector('tommy-flow-runner')).toBeNull();
  });
});
