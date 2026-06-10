import type { ComponentFixture } from '@angular/core/testing';
import { TestBed } from '@angular/core/testing';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { FormField, required, schema } from '@angular/forms/signals';
import { createFlow, type Flow } from './create-flow';
import { FlowBackend, FLOW_FIXTURES, type FlowFixture } from './io/flow-backend';
import { FlowResume } from './io/flow-resume';
import { FlowStateStore } from './io/flow-state-store';
import { ExternalRedirect } from './io/external-redirect';
import { FlowRunner } from './runner/flow-runner';
import { FlowStep } from './runner/flow-step';
import { FlowIntro, FlowReceipt } from './runner/flow-slots';
import type { FlowConfig } from './runner/flow-config';

interface M { one: { name: string }; }
const CONFIG: FlowConfig<M> = {
  meta: { slug: 'test', title: 'T', blurb: 'b', dimension: 'minimal' },
  schemaVersion: 1,
  toSubmission: (m) => m,
  restore: (raw) => raw as M,
};
const SCHEMA = (_env: unknown) => schema<M>((p) => required(p.one.name, { message: 'Name required' }));

@Component({
  selector: 'tommy-cf-host',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, FormField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <tommy-flow-runner [config]="flow.config" [form]="flow.form()" [loadError]="flow.loadErrorMsg()"
                       [resume]="flow.signature()" (retry)="flow.env.reload()">
      <ng-template flowIntro><p class="ui-muted">intro copy</p></ng-template>
      @if (flow.form(); as form) {
        <ng-template [flowStep]="form.one" flowStepKey="one" flowStepLabel="One" let-field let-showErrors="showErrors">
          <input [formField]="field.name" id="cf-name" />
        </ng-template>
      }
      <ng-template flowReceipt let-result><p id="cf-rcpt">done {{ result.confirmationId }}</p></ng-template>
    </tommy-flow-runner>
  `,
})
class CfHost {
  readonly flow: Flow<M> = createFlow<M>({
    config: CONFIG,
    schema: SCHEMA,
    emptyModel: () => ({ one: { name: '' } }),
    // Overwrites UNCONDITIONALLY so the resume test can prove the skip-guard works:
    // if seedDefaults wrongly ran on resume, it would clobber 'Restored' → 'seeded'.
    seedDefaults: (m) => ({ ...m, one: { name: 'seeded' } }),
  });
}

class FakeRedirect { lastUrl: string | null = null; origin = 'https://lab.example'; to(u: string) { this.lastUrl = u; } }

function providersWith(fixtures: Map<string, FlowFixture>) {
  return [
    FlowBackend, FlowStateStore, FlowResume,
    { provide: ExternalRedirect, useValue: new FakeRedirect() },
    { provide: FLOW_FIXTURES, useValue: fixtures },
  ];
}
const OK: FlowFixture['submit'] = (_p, sig) =>
  sig ? ({ status: 'ok', httpStatus: 200, confirmationId: 'SIGNED-1' } as const)
      : ({ status: 'signing_required', httpStatus: 202, signingUrl: 'https://idp/x', challengeId: 'c' } as const);

async function settle(fixture: ComponentFixture<unknown>, ms = 700) {
  await new Promise((r) => setTimeout(r, ms));
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('createFlow', () => {
  afterEach(() => sessionStorage.clear());

  it('fresh start: emptyModel, then env resolves → form built + seedDefaults applied, no loadError', async () => {
    TestBed.configureTestingModule({ providers: providersWith(new Map([['test', { features: {}, terms: {}, submit: OK }]])) });
    const fixture = TestBed.createComponent(CfHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    expect(host.flow.form()).toBeUndefined();
    expect(host.flow.signature()).toBeNull();
    expect(host.flow.loadErrorMsg()).toBeNull();
    expect(host.flow.model().one.name).toBe('');
    await settle(fixture);
    expect(host.flow.form()).toBeDefined();
    expect(host.flow.loadErrorMsg()).toBeNull();
    expect(host.flow.model().one.name).toBe('seeded');
  });

  it('resume: restores model, skips seedDefaults, sets signature after render', async () => {
    TestBed.configureTestingModule({ providers: providersWith(new Map([['test', { features: {}, terms: {}, submit: OK }]])) });
    TestBed.inject(FlowStateStore).save({ flowSlug: 'test', schemaVersion: 1, state: 'st-1', challengeId: 'c', model: { one: { name: 'Restored' } } });
    TestBed.inject(FlowResume).consume(
      { get: (k: string) => ({ mitid: 'callback', flow: 'test', status: 'approved', state: 'st-1', code: 'otc' } as Record<string, string>)[k] ?? null },
      () => 1,
    );
    const fixture = TestBed.createComponent(CfHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    expect(host.flow.model().one.name).toBe('Restored');
    await settle(fixture);
    expect(host.flow.model().one.name).toBe('Restored');
    expect(host.flow.signature()).not.toBeNull();
  });

  it('load failure (no fixture for slug) → loadErrorMsg set, form stays undefined', async () => {
    TestBed.configureTestingModule({ providers: providersWith(new Map()) });
    const fixture = TestBed.createComponent(CfHost);
    const host = fixture.componentInstance;
    fixture.detectChanges();
    await settle(fixture);
    expect(host.flow.loadErrorMsg()).toBe('Could not start this flow. Please retry.');
    expect(host.flow.form()).toBeUndefined();
  });
});
