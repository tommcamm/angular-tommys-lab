import type { FlowOptions } from './flow-options';

export interface ProfileGroup {
  firstName: string;
  lastName: string;
  email: string;
}

export interface AccountGroup {
  username: string;
  password: string;
  confirmPassword: string;
}

export interface TosAck {
  id: string;
  required: boolean;
  accepted: boolean;
}

export interface FlowModel {
  profile: ProfileGroup;
  account: AccountGroup;
  tos: TosAck[];
}

/** A fresh model whose TOS array mirrors the backend-provided list. */
export function emptyFlowModel(options: FlowOptions): FlowModel {
  return {
    profile: { firstName: '', lastName: '', email: '' },
    account: { username: '', password: '', confirmPassword: '' },
    tos: options.tos.map((t) => ({ id: t.id, required: t.required, accepted: false })),
  };
}
