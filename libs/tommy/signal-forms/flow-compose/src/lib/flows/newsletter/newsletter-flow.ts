import { ChangeDetectionStrategy, Component, Injector, afterNextRender, computed, effect, inject, resource, signal } from '@angular/core';
import type { Signature } from '../../flow-types';
import { FlowBackend } from '../../io/flow-backend';
import { FlowResume } from '../../io/flow-resume';
import { FlowRunner } from '../../runner/flow-runner';
import { FlowStep } from '../../runner/flow-step';
import { FlowIntro, FlowReceipt } from '../../runner/flow-slots';
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
  // Held back until the form (and thus the projected step inputs) has rendered: the
  // runner's resume effect reads the active step's `field` input synchronously, so the
  // step <ng-template>s must be committed before the signature reaches the runner.
  protected readonly signature = signal<Signature | null>(null);
  protected readonly loadErrorMsg = computed(() =>
    this.env.error() ? 'Could not start this flow. Please retry.' : null,
  );

  constructor() {
    // Seed env-derived defaults (the tos[] array) once env resolves — NOT when resuming
    // (the restored model already carries the user's tos answers).
    effect(() => {
      if (this.pending || !this.env.hasValue()) return;
      this.model.update((m) => ({ ...m, tos: tosAcksFrom(this.env.value()!.terms) }));
    });

    // Resume case: once the form exists, defer the signature one render so the step
    // templates' `[flowStep]` inputs are committed before the runner re-submits.
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
