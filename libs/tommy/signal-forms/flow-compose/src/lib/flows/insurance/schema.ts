import { apply, applyEach, required, schema, validate } from '@angular/forms/signals';
import { applyFeature } from '../../engine/schema-helpers';
import type { FlowEnvelope } from '../../engine/flow-types';
import type { InsuranceModel } from './model';

export function insuranceSchema(env: FlowEnvelope) {
  const maxAmount =
    (env.features['AMOUNT'] as { maxAmount?: number } | undefined)?.maxAmount ?? Infinity;
  return schema<InsuranceModel>((p) => {
    applyFeature(
      p.policy.policyNumber,
      env.features['POLICY_NUMBER'] ?? { mandatory: true },
      { requiredMessage: 'Policy number is required' },
    );
    apply(
      p.incident,
      schema((i) => {
        required(i.date, { message: 'Incident date is required' });
        required(i.description, { message: 'Describe what happened' });
        // Conditional cross-field: injury details required only when injured is checked.
        validate(i.injuryDetails, (ctx) =>
          ctx.valueOf(i.injured) && !ctx.value().trim()
            ? { kind: 'required', message: 'Describe the injury' }
            : null,
        );
      }),
    );
    applyEach(p.items, (item) => {
      required(item.description, { message: 'Item description is required' });
      validate(item.amount, (ctx) =>
        Number(ctx.value()) > 0
          ? null
          : { kind: 'amountPositive', message: 'Amount must be greater than 0' },
      );
    });
    // Cross-field over the whole array: total claimed must not exceed coverage.
    validate(p.items, (ctx) => {
      const total = ctx.value().reduce((sum, it) => sum + (Number(it.amount) || 0), 0);
      return total > maxAmount
        ? {
            kind: 'overCoverage',
            message: `Total claimed (${total}) exceeds coverage of ${maxAmount}`,
          }
        : null;
    });
  });
}
