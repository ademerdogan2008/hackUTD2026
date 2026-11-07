export type Role =
  | 'admin' | 'lead' | 'it' | 'counsel' | 'comms'
  | 'executive' | 'finance' | 'hr' | 'guest' | 'observer';

export const ROLES: readonly Role[] = [
  'admin', 'lead', 'it', 'counsel', 'comms', 'executive', 'finance', 'hr', 'guest', 'observer',
];

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Admin',
  lead: 'Incident Lead',
  it: 'IT',
  counsel: 'Counsel',
  comms: 'Comms',
  executive: 'Executive',
  finance: 'Finance',
  hr: 'HR',
  guest: 'Guest',
  observer: 'Observer',
};

export function isRole(x: string): x is Role {
  return (ROLES as readonly string[]).includes(x);
}

const LEAD_TARGETS: readonly Role[] = ['it', 'counsel', 'comms', 'executive', 'finance', 'hr', 'guest', 'observer'];

/** Which roles may `inviter` invite as `target`. */
export function canInvite(inviter: Role, target: Role): boolean {
  if (inviter === 'admin') return target !== 'admin';
  if (inviter === 'lead') return LEAD_TARGETS.includes(target);
  if (inviter === 'counsel') return target === 'guest';
  return false;
}
