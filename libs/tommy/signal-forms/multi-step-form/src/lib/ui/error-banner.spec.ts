import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ErrorBanner } from './error-banner';

@Component({
  imports: [ErrorBanner],
  template: `<tommy-error-banner [messages]="messages()" />`,
})
class Host {
  readonly messages = signal<readonly string[]>([]);
}

describe('ErrorBanner', () => {
  it('renders nothing when there are no messages', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('renders an alert with a list item per message', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.messages.set([
      'First name is required',
      'Email is required',
    ]);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const alert = el.querySelector('[role=alert]');
    expect(alert).not.toBeNull();
    expect(alert?.textContent).toContain('One or more fields have errors');
    const items = el.querySelectorAll('.ui-banner-list li');
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain('First name is required');
  });

  it('removes the alert when messages are cleared', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.messages.set(['First name is required']);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role=alert]'),
    ).not.toBeNull();

    fixture.componentInstance.messages.set([]);
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('[role=alert]'),
    ).toBeNull();
  });
});
