import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import { useCurrentIncident, useMe } from '../../state/hooks';
import { AlarmOverlay } from '../../ui';

// Shared across instances so mounting in home AND app-wide never double-shows.
const acked = new Set<string>();
const mounted: object[] = [];
const listeners = new Set<() => void>();
let version = 0;
const emit = () => {
  version++;
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function acknowledgeIncident(id: bigint) {
  acked.add(id.toString());
  emit();
}

/** Full-screen alarm when an incident turns active and this device has not acknowledged it. */
export function GlobalAlarm() {
  const token = useRef({}).current;
  useEffect(() => {
    mounted.push(token);
    emit();
    return () => {
      mounted.splice(mounted.indexOf(token), 1);
      emit();
    };
  }, [token]);
  useSyncExternalStore(subscribe, () => version);

  const { me } = useMe();
  const { incident } = useCurrentIncident();
  const [checkins, ready] = useTable(tables.checkin);
  const checkIn = useReducer(reducers.checkIn);

  // Already checked in (e.g. earlier session) counts as acknowledged.
  const id = incident?.id;
  const mine = id !== undefined && me ? checkins.some((c) => c.incidentId === id && c.member.isEqual(me.identity)) : false;
  const isOwner = mounted[0] === token;
  const visible = !!incident && !!me && ready && isOwner && incident.status === 'active' && !mine && !acked.has(incident.id.toString());

  const onAction = () => {
    if (!incident) return;
    acknowledgeIncident(incident.id);
    checkIn({ state: 'here' }).catch(() => {});
  };
  return (
    <AlarmOverlay
      visible={visible}
      title="Attack confirmed"
      subtitle={incident?.isDrill ? 'This is a drill. Check in now.' : 'Check in now. Your team needs to know you are here.'}
      actionLabel="I'm here"
      onAction={onAction}
    />
  );
}
