import { apply, applyEach, email, required, schema, validate } from '@angular/forms/signals';
import type { FlowEnvelope } from '../../flow-types';
import type { NewsletterModel } from './model';

export function newsletterSchema(env: FlowEnvelope) {
  return schema<NewsletterModel>((p) => {
    apply(
      p.contact,
      schema((c) => {
        if (env.features['NAME']?.mandatory) required(c.name, { message: 'Name is required' });
        if (env.features['EMAIL']?.mandatory) required(c.email, { message: 'Email is required' });
        email(c.email, { message: 'Enter a valid email address' });
      }),
    );
    applyEach(p.tos, (item) => {
      validate(item.accepted, (ctx) =>
        ctx.valueOf(item.required) && !ctx.value()
          ? { kind: 'mustAccept', message: 'You must accept this to continue' }
          : null,
      );
    });
  });
}
