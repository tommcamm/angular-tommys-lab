import {
  required,
  minLength,
  maxLength,
  type PathKind,
  type SchemaPathRules,
  type SchemaPath,
} from '@angular/forms/signals';
import type { FeatureDescriptor } from './flow-def';

export interface LengthBounds {
  readonly minLength?: number;
  readonly maxLength?: number;
}

/**
 * Feature-aware schema helper, reusable across every flow. Reads the shared
 * descriptor base (`mandatory`) and any common refinements (length bounds) and
 * applies the matching signal-forms validators to `node`.
 *
 * `node` is a string-valued schema path; generic over the path kind so it can
 * be applied to root, child, or array-item fields inside a `schema()` callback.
 */
export function applyFeature<
  TPathKind extends PathKind = PathKind.Root,
>(
  node: SchemaPath<string, SchemaPathRules.Supported, TPathKind>,
  descriptor: FeatureDescriptor & LengthBounds,
  opts: {
    readonly requiredMessage: string;
    readonly minLengthMessage?: (n: number) => string;
    readonly maxLengthMessage?: (n: number) => string;
  },
): void {
  if (descriptor.mandatory) {
    required(node, { message: opts.requiredMessage });
  }
  if (descriptor.minLength != null) {
    minLength(node, descriptor.minLength, {
      message:
        opts.minLengthMessage?.(descriptor.minLength) ??
        `Must be at least ${descriptor.minLength} characters`,
    });
  }
  if (descriptor.maxLength != null) {
    maxLength(node, descriptor.maxLength, {
      message:
        opts.maxLengthMessage?.(descriptor.maxLength) ??
        `Must be at most ${descriptor.maxLength} characters`,
    });
  }
}
