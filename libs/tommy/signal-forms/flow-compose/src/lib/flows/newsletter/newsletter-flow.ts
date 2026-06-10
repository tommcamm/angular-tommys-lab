import { ChangeDetectionStrategy, Component } from '@angular/core';
import { createFlow } from '../../create-flow';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
import { ContactStep } from './steps/contact-step';
import { PrefsStep } from './steps/prefs-step';
import { NEWSLETTER_FLOW_CONFIG } from './newsletter-config';
import { emptyNewsletterModel, type NewsletterModel } from './model';
import { newsletterSchema } from './schema';

@Component({
  selector: 'tommy-newsletter-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, ContactStep, PrefsStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './newsletter-flow.html',
})
export class NewsletterFlow {
  protected readonly flow = createFlow<NewsletterModel>({
    config: NEWSLETTER_FLOW_CONFIG,
    schema: newsletterSchema,
    emptyModel: emptyNewsletterModel,
    seedDefaults: (m, env) => ({ ...m, tos: tosAcksFrom(env.terms) }),
  });
}
