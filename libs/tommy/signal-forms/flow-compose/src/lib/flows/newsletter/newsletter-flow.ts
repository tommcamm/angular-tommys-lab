import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, resource, signal } from '@angular/core';
import type { Signature } from '../../engine/flow-types';
import { FlowBackend } from '../../engine/flow-backend';
import { FlowResume } from '../../engine/flow-resume';
import { FlowRunner } from '../../engine/flow-runner';
import { FlowStep } from '../../engine/flow-step';
import { FlowIntro, FlowReceipt } from '../../engine/flow-slots';
import { tosAcksFrom, TosStep } from '../../steps/tos-step';
import { ContactStep } from './steps/contact-step';
import { PrefsStep } from './steps/prefs-step';
import { NEWSLETTER_FLOW_CONFIG } from './newsletter-config';
import { emptyNewsletterModel, type NewsletterModel } from './model';
import { newsletterForm } from './form';

@Component({
  selector: 'tommy-newsletter-flow',
  imports: [FlowRunner, FlowStep, FlowIntro, FlowReceipt, ContactStep, PrefsStep, TosStep],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './newsletter-flow.html',
})
export class NewsletterFlow {
  private readonly injector = inject(Injector);
  private readonly backend = inject(FlowBackend);
  private readonly resume = inject(FlowResume);
  private readonly pending = this.resume.pending('newsletter');

  protected readonly config = NEWSLETTER_FLOW_CONFIG;
  protected readonly env = resource({ loader: () => this.backend.loadOptions('newsletter') });
  protected readonly model = signal<NewsletterModel>(
    this.pending
      ? ((NEWSLETTER_FLOW_CONFIG.restore?.(this.pending.model) ?? this.pending.model) as NewsletterModel)
      : emptyNewsletterModel(),
  );
  protected readonly form = computed(() =>
    this.env.hasValue() ? newsletterForm(this.model, this.env.value()!, this.injector) : undefined,
  );
  // Held back until the form has rendered (see bank-flow for the timing rationale).
  protected readonly signature = signal<Signature | null>(null);
  protected readonly loadErrorMsg = computed(() =>
    this.env.error() ? 'Could not start this flow. Please retry.' : null,
  );

  constructor() {
    // Seed env-derived defaults (the tos[] array) once env resolves — NOT when resuming.
    effect(() => {
      if (this.pending || !this.env.hasValue()) return;
      this.model.update((m) => ({ ...m, tos: tosAcksFrom(this.env.value()!.terms) }));
    });

    const sig = this.pending?.signature;
    if (sig) {
      let scheduled = false;
      effect(() => {
        if (scheduled || !this.form()) return;
        scheduled = true;
        afterNextRender(() => this.signature.set(sig), { injector: this.injector });
      });
    }
  }
}
