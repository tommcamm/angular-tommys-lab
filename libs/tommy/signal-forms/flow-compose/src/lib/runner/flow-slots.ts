import { Directive, TemplateRef, inject } from '@angular/core';
import type { SubmitOk } from '../flow-types';

/** Intro body. No context — it is defined in the flow's own template and closes over env(). */
@Directive({ selector: 'ng-template[flowIntro]' })
export class FlowIntro {
  readonly template = inject(TemplateRef);
}

export interface FlowReceiptContext {
  $implicit: SubmitOk;
}

/** Receipt body. Receives the captured ok outcome (incl. confirmationId). */
@Directive({ selector: 'ng-template[flowReceipt]' })
export class FlowReceipt {
  readonly template = inject<TemplateRef<FlowReceiptContext>>(TemplateRef);
  static ngTemplateContextGuard(
    _dir: FlowReceipt,
    _ctx: unknown,
  ): _ctx is FlowReceiptContext {
    return true;
  }
}
