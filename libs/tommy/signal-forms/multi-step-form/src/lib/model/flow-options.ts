/** A single Terms-of-Service item the backend asks the user to acknowledge. */
export interface TosItem {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly required: boolean;
}

/** Constraints + TOS the "backend" returns when the flow starts. */
export interface FlowOptions {
  readonly username: { readonly minLength: number; readonly maxLength: number };
  readonly password: { readonly minLength: number };
  readonly tos: readonly TosItem[]; // 0..*
}

/** The payload we send back on submit. */
export interface FlowSubmission {
  readonly profile: {
    readonly firstName: string;
    readonly lastName: string;
    readonly email: string;
  };
  readonly account: { readonly username: string; readonly password: string };
  readonly acceptedTosIds: readonly string[];
}

/** Result of a submit attempt. */
export type SubmitResult =
  | { readonly ok: true; readonly confirmationId: string }
  | {
      readonly ok: false;
      readonly fieldErrors: readonly {
        readonly field: 'username';
        readonly message: string;
      }[];
    };
