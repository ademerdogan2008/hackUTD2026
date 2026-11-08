// Shared Jev triage state: which rows are "fresh" (arrived after this app session loaded).
import { useTable } from 'spacetimedb/react';
import { Platform } from 'react-native';
import { tables } from '../../module_bindings';

type TriageRow = { id: bigint; decision: string; incidentId: bigint };

// Snapshot of `${id}:${decision}` at first sync. Rows (or decisions) in it never alarm.
let baseline: Set<string> | null = null;
const keyOf = (r: TriageRow) => `${r.id.toString()}:${r.decision}`;

export const ALARM_DECISIONS = new Set(['auto_opened', 'confirmed']);

/** Triage rows plus `fresh(r)`: true only for rows/decisions that changed after initial sync. */
export function useJevTriage() {
  const [rows, ready] = useTable(tables.jevTriage);
  if (ready && !baseline) baseline = new Set(rows.map(keyOf));
  const fresh = (r: TriageRow) => !!baseline && !baseline.has(keyOf(r));
  return { rows, ready, fresh };
}

/** True when a fresh Jev alarm owns this incident (so the generic incident alarm stays quiet). */
export function useJevOwnsIncident(incidentId: bigint | undefined): boolean {
  const { rows, fresh } = useJevTriage();
  if (incidentId === undefined) return false;
  return rows.some((r) => r.incidentId === incidentId && ALARM_DECISIONS.has(r.decision) && fresh(r));
}

const notified = new Set<string>();

/** Content-free system notification (web Notification API). Native relies on the overlay + haptics. */
export function notifyOnce(key: string, body = 'Open app') {
  if (notified.has(key)) return;
  notified.add(key);
  if (Platform.OS !== 'web') return;
  try {
    const N = (globalThis as { Notification?: { permission: string; requestPermission?: () => Promise<string>; new (t: string, o?: { body?: string; tag?: string }): unknown } }).Notification;
    if (!N) return;
    const show = () => new N('Red Phone', { body, tag: key });
    if (N.permission === 'granted') show();
    else if (N.permission !== 'denied' && N.requestPermission) N.requestPermission().then((p) => p === 'granted' && show()).catch(() => {});
  } catch {
    // Notifications are best-effort.
  }
}
