import { Component, contentChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NgTemplateOutlet } from '@angular/common';
import { FlowIntro, FlowReceipt } from './flow-slots';
import type { SubmitOk } from './flow-types';

/**
 * Wrapper child that queries its projected content for FlowIntro and FlowReceipt.
 * contentChild sees PROJECTED content, not own-view content — so the ng-templates
 * must be projected into this wrapper from the parent's template.
 */
@Component({
  selector: 'tommy-slot-runner',
  imports: [NgTemplateOutlet],
  template: `
    <ng-container [ngTemplateOutlet]="intro()!.template" />
    <ng-container
      [ngTemplateOutlet]="receipt()!.template"
      [ngTemplateOutletContext]="{ $implicit: ok }"
    />
  `,
})
class SlotRunner {
  readonly intro = contentChild(FlowIntro);
  readonly receipt = contentChild(FlowReceipt);
  readonly ok: SubmitOk = { status: 'ok', httpStatus: 200, confirmationId: 'OK-1' };
}

@Component({
  selector: 'tommy-slot-host',
  imports: [FlowIntro, FlowReceipt, SlotRunner],
  template: `
    <tommy-slot-runner>
      <ng-template flowIntro><span id="intro">hello</span></ng-template>
      <ng-template flowReceipt let-r><span id="rcpt">{{ r.confirmationId }}</span></ng-template>
    </tommy-slot-runner>
  `,
})
class SlotHost {}

/** Minimal runner whose only contract is a REQUIRED flowIntro slot. */
@Component({
  selector: 'tommy-required-intro-runner',
  template: `<ng-container [ngTemplateOutlet]="intro().template" />`,
  imports: [NgTemplateOutlet],
})
class RequiredIntroRunner {
  readonly intro = contentChild.required(FlowIntro);
}

/** Host that omits the required flowIntro slot — must throw at creation. */
@Component({
  selector: 'tommy-missing-intro-host',
  imports: [RequiredIntroRunner],
  template: `<tommy-required-intro-runner />`,
})
class MissingIntroHost {}

describe('Flow slots', () => {
  it('projects intro body and receipt body with the ok outcome', () => {
    const fixture = TestBed.createComponent(SlotHost);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('#intro')?.textContent).toBe('hello');
    expect(el.querySelector('#rcpt')?.textContent).toBe('OK-1');
  });

  it('throws when a required slot (flowIntro) is omitted', () => {
    expect(() => {
      const fixture = TestBed.createComponent(MissingIntroHost);
      fixture.detectChanges();
    }).toThrow();
  });
});
