import { Component, contentChildren, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { form, type FieldTree } from '@angular/forms/signals';
import { NgTemplateOutlet } from '@angular/common';
import { FlowStep } from './flow-step';

interface M {
  a: { x: string };
}

/**
 * Wrapper child that queries its projected content for FlowStep directives.
 * contentChildren sees PROJECTED content, not own-view content — so the
 * ng-template[flowStep] must live in the PARENT's template as <tommy-fs-runner>
 * projected children.
 */
@Component({
  selector: 'tommy-fs-runner',
  imports: [NgTemplateOutlet],
  template: `
    <ng-container
      [ngTemplateOutlet]="steps()[0]?.template ?? null"
      [ngTemplateOutletContext]="{ $implicit: steps()[0]?.field(), showErrors: false }"
    />
  `,
})
class FsRunner {
  readonly steps = contentChildren(FlowStep);
}

@Component({
  selector: 'tommy-fs-host',
  imports: [FlowStep, FsRunner],
  template: `
    <tommy-fs-runner>
      <ng-template [flowStep]="f.a" flowStepKey="a" flowStepLabel="A" let-field>
        <span id="val">{{ field().value().x }}</span>
      </ng-template>
    </tommy-fs-runner>
  `,
})
class FsHost {
  readonly model = signal<M>({ a: { x: 'hi' } });
  readonly f: FieldTree<M> = form(this.model);
}

describe('FlowStep', () => {
  it('exposes key/label/field via aliases and renders the slice through its template', () => {
    const fixture = TestBed.createComponent(FsHost);
    fixture.detectChanges();

    // Get the runner child to check the query
    const runnerEl = (fixture.nativeElement as HTMLElement).querySelector('tommy-fs-runner');
    expect(runnerEl).not.toBeNull();

    // Retrieve the FsRunner component instance to inspect the content query
    const runnerDebug = fixture.debugElement.query(
      (de) => de.componentInstance instanceof FsRunner,
    );
    const runner: FsRunner = runnerDebug.componentInstance as FsRunner;

    const steps = runner.steps();
    expect(steps.length).toBe(1);
    expect(steps[0].key()).toBe('a');
    expect(steps[0].label()).toBe('A');
    expect((fixture.nativeElement as HTMLElement).querySelector('#val')?.textContent).toBe('hi');
  });
});
