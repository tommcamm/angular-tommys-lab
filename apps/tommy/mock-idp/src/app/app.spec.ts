import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { QUERY, Redirect } from './redirect';

class FakeRedirect {
  last: string | null = null;
  go(u: string) {
    this.last = u;
  }
}

function mount(query: string, redirect: FakeRedirect) {
  TestBed.configureTestingModule({
    imports: [App],
    providers: [
      { provide: Redirect, useValue: redirect },
      { provide: QUERY, useValue: query },
    ],
  });
  const f = TestBed.createComponent(App);
  f.detectChanges();
  return f;
}

describe('mock-idp App', () => {
  const ret = encodeURIComponent(
    'http://localhost:4200/flow-forge?mitid=callback&flow=bank',
  );

  it('approve redirects back with approved + state + code (allowed origin)', () => {
    const r = new FakeRedirect();
    const f = mount(`?challenge=ch1&state=S1&return=${ret}`, r);
    const el = f.nativeElement as HTMLElement;
    (
      Array.from(el.querySelectorAll('button')).find((b) =>
        /approve/i.test(b.textContent ?? ''),
      ) as HTMLButtonElement
    ).click();
    expect(r.last).toContain('status=approved');
    expect(r.last).toContain('state=S1');
    expect(r.last).toMatch(/code=/);
    expect(r.last).toContain('http://localhost:4200/flow-forge');
  });

  it('cancel redirects back with cancelled + state', () => {
    const r = new FakeRedirect();
    const f = mount(`?challenge=ch1&state=S1&return=${ret}`, r);
    const el = f.nativeElement as HTMLElement;
    (
      Array.from(el.querySelectorAll('button')).find((b) =>
        /cancel/i.test(b.textContent ?? ''),
      ) as HTMLButtonElement
    ).click();
    expect(r.last).toContain('status=cancelled');
    expect(r.last).toContain('state=S1');
  });

  it('rejects a return URL whose origin is not allow-listed', () => {
    const r = new FakeRedirect();
    const f = mount(
      `?challenge=ch1&state=S1&return=${encodeURIComponent('http://evil.example/x')}`,
      r,
    );
    const el = f.nativeElement as HTMLElement;
    const approve = Array.from(el.querySelectorAll('button')).find((b) =>
      /approve/i.test(b.textContent ?? ''),
    ) as HTMLButtonElement | undefined;
    approve?.click();
    expect(r.last).toBeNull();
    expect(el.textContent?.toLowerCase()).toContain('invalid');
  });
});
