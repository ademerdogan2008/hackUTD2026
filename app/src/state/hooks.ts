// Shared data hooks for Flare screens. All live data comes from Spacetime
// subscriptions via generated bindings; screens should use these instead of
// re-deriving "who am I" / "current incident" themselves.
import { useMemo } from 'react';
import { useSpacetimeDB, useTable } from 'spacetimedb/react';
import { tables } from '../module_bindings';

export type Role =
  | 'admin'
  | 'lead'
  | 'it'
  | 'counsel'
  | 'comms'
  | 'executive'
  | 'finance'
  | 'hr'
  | 'guest'
  | 'observer';

const OPEN_STATUSES = new Set(['possible', 'active', 'contained', 'recovered']);

/** The caller's member row, or undefined if not enrolled (or still loading). */
export function useMe() {
  const { identity } = useSpacetimeDB();
  const [members, ready] = useTable(tables.member);
  const me = useMemo(
    () => (identity ? members.find((m) => m.identity.isEqual(identity)) : undefined),
    [members, identity],
  );
  return { me, members, ready, identityHex: identity?.toHexString() ?? '' };
}

export function isLeadOrAdmin(role: string | undefined): boolean {
  return role === 'lead' || role === 'admin';
}

export function canSeeCounsel(role: string | undefined): boolean {
  return role === 'counsel' || role === 'lead' || role === 'admin';
}

/** The most recent incident that is still open, if any. */
export function useCurrentIncident() {
  const [incidents, ready] = useTable(tables.incident);
  const incident = useMemo(() => {
    const open = incidents.filter((i) => OPEN_STATUSES.has(i.status));
    open.sort((a, b) => (a.id > b.id ? -1 : 1));
    return open[0];
  }, [incidents]);
  return { incident, ready };
}

/** Name lookup by identity hex for display. */
export function useMemberNames() {
  const [members] = useTable(tables.member);
  return useMemo(() => {
    const map = new Map<string, { name: string; role: string }>();
    for (const m of members) map.set(m.identity.toHexString(), { name: m.name, role: m.role });
    return map;
  }, [members]);
}

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Admin',
  lead: 'Incident Lead',
  it: 'IT / Security',
  counsel: 'Counsel',
  comms: 'Comms',
  executive: 'Executive',
  finance: 'Finance',
  hr: 'HR',
  guest: 'Guest',
  observer: 'Observer',
};
