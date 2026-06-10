import { apply, applyEach, schema, validate } from '@angular/forms/signals';
import { applyFeature } from '../../forms/schema-helpers';
import type { FlowEnvelope } from '../../flow-types';
import type { BankModel } from './model';

export function bankSchema(env: FlowEnvelope) {
  return schema<BankModel>((p) => {
    apply(
      p.applicant,
      schema((a) => {
        applyFeature(a.fullName, env.features['FULL_NAME'] ?? { mandatory: true }, {
          requiredMessage: 'Full name is required',
        });
        applyFeature(a.cpr, env.features['CPR'] ?? { mandatory: true }, {
          requiredMessage: 'CPR number is required',
        });
      }),
    );
    validate(p.account.accountType, (ctx) =>
      ctx.value() ? null : { kind: 'required', message: 'Choose an account type' },
    );
    applyEach(p.tos, (item) =>
      validate(item.accepted, (ctx) =>
        ctx.valueOf(item.required) && !ctx.value()
          ? { kind: 'mustAccept', message: 'You must accept this to continue' }
          : null,
      ),
    );
  });
}
