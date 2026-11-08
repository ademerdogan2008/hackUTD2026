// Shared task selectors: severity-ordered task lists and "my next step" for the current incident.
import { useMemo } from 'react';
import { useTable } from 'spacetimedb/react';
import { severityOf, type Severity } from '@redphone/shared';
import { tables } from '../module_bindings';
import { isLeadOrAdmin, useCurrentIncident, useMe } from './hooks';

const STATUS_RANK: Record<string, number> = { accepted: 0, open: 1, locked: 2, done: 3 };

export type RankedTask = {
  id: bigint;
  title: string;
  detail: string;
  role: string;
  status: string;
  assignedTo: string;
  assignedName: string;
  stepId: bigint;
  order: number;
  severity: Severity;
  waitsFor?: string;
};

/** All tasks for the current incident, most important first (severity band, then playbook order). */
export function useRankedTasks() {
  const { incident } = useCurrentIncident();
  const { identityHex, me } = useMe();
  const [tasks] = useTable(tables.task);
  const [steps] = useTable(tables.playbookStep);

  return useMemo(() => {
    const stepById = new Map(steps.map((s) => [s.id, s]));
    const titleByStep = new Map(steps.map((s) => [s.id, s.title]));
    const ranked: RankedTask[] = tasks
      .filter((t) => incident && t.incidentId === incident.id)
      .map((t) => {
        const step = stepById.get(t.stepId);
        // Jev's pre-filled tasks (stepId 0) have no playbook step; treat them as critical.
        const order = step?.order ?? (t.stepId === 0n ? 100 : 999);
        return {
          id: t.id,
          title: t.title,
          detail: t.detail,
          role: t.role,
          status: t.status,
          assignedTo: t.assignedTo,
          assignedName: t.assignedName,
          stepId: t.stepId,
          order,
          severity: severityOf(order),
          waitsFor: step && step.dependsOn ? titleByStep.get(step.dependsOn) : undefined,
        };
      })
      .sort((a, b) => a.order - b.order);
    // Tasks for a role nobody holds yet are unassigned; leads and admins see them so they can act.
    const staff = isLeadOrAdmin(me?.role);
    const mine = ranked.filter((t) => t.assignedTo === identityHex || (staff && !t.assignedTo));
    // Next step: in-progress first, then the most severe open task.
    const next = [...mine]
      .filter((t) => t.status === 'open' || t.status === 'accepted')
      .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.order - b.order)[0];
    const doneCount = mine.filter((t) => t.status === 'done').length;
    return { all: ranked, mine, next, doneCount, total: mine.length, hasPlaybook: !!incident?.attackType };
  }, [tasks, steps, incident, identityHex, me?.role]);
}
