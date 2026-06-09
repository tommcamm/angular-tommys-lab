import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FLOW_FIXTURES, FlowBackend } from './engine/flow-backend';
import { FlowResume } from './engine/flow-resume';
import { NewsletterFlow } from './flows/newsletter/newsletter-flow';
import { BankFlow } from './flows/bank/bank-flow';
import { InsuranceFlow } from './flows/insurance/insurance-flow';
import { FLOW_CARDS, FLOW_VERSIONS } from './flow-cards';
import { FLOW_FIXTURES_MAP } from './flow-fixtures';

@Component({
  selector: 'tommy-flow-compose',
  imports: [NewsletterFlow, BankFlow, InsuranceFlow],
  providers: [{ provide: FLOW_FIXTURES, useValue: FLOW_FIXTURES_MAP }, FlowBackend],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './flow-compose.html',
})
export class FlowCompose {
  private readonly route = inject(ActivatedRoute);
  private readonly resume = inject(FlowResume);

  protected readonly cards = FLOW_CARDS;
  protected readonly selected = signal<string | null>(null);
  protected readonly returnNotice = signal<string | null>(null);

  constructor() {
    const slug = this.resume.consume(this.route.snapshot.queryParamMap, (s) => FLOW_VERSIONS[s]);
    if (slug) {
      this.selected.set(slug);
      if (this.resume.cancelledNotice(slug)) {
        this.returnNotice.set('Signing cancelled — you can review and resubmit.');
      }
    }
  }

  select(slug: string): void {
    this.returnNotice.set(null);
    this.selected.set(slug);
  }
  clear(): void {
    this.returnNotice.set(null);
    this.selected.set(null);
  }
  badgeClass(dimension: string): string {
    return dimension === 'signing' ? 'ui-badge-orange' : dimension === 'complex' ? 'ui-badge-green' : 'ui-badge-blue';
  }
}
