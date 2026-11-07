import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { isLeadOrAdmin, ROLE_LABEL, useCurrentIncident, useMe } from '../../state/hooks';
import { Badge, Button, Card, EmptyState, haptics, Screen, space, T, type Variant } from '../../ui';

import type { Task } from '../../module_bindings/types';

const STATUS: Record<string, { label: string; variant: Variant }> = {
  open: { label: 'Open', variant: 'info' },
  accepted: { label: 'In progress', variant: 'warning' },
  done: { label: 'Done', variant: 'success' },
  locked: { label: 'Locked', variant: 'neutral' },
};

export default function TasksScreen() {
  const { me, identityHex } = useMe();
  const { incident, ready } = useCurrentIncident();
  const [allTasks] = useTable(tables.task);
  const [steps] = useTable(tables.playbookStep);
  const accept = useReducer(reducers.acceptTask);
  const complete = useReducer(reducers.completeTask);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const tasks = useMemo(
    () => allTasks.filter((t) => incident && t.incidentId === incident.id).sort((a, b) => (a.id < b.id ? -1 : 1)),
    [allTasks, incident],
  );
  const mine = tasks.filter((t) => t.assignedTo === identityHex);
  const next = mine.find((t) => t.status === 'open' || t.status === 'accepted');

  const waitsFor = (t: Task) => {
    const step = steps.find((s) => s.id === t.stepId);
    if (!step || step.dependsOn === 0n) return '';
    return tasks.find((x) => x.stepId === step.dependsOn)?.title ?? '';
  };

  const act = async (t: Task) => {
    setBusy(true);
    setErr('');
    try {
      if (t.status === 'open') await accept({ taskId: t.id });
      else await complete({ taskId: t.id });
      haptics.success();
    } catch (e) {
      haptics.error();
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const header = { title: 'Tasks', headerRight: <ConnectionBadge /> };
  if (!ready || !me) return <Screen {...header}><EmptyState title="Loading" /></Screen>;
  if (!incident) return <Screen {...header}><EmptyState title="No active incident" body="Tasks appear once an incident is active." /></Screen>;
  if (!incident.attackType)
    return (
      <Screen {...header}>
        <EmptyState title="Waiting for the Lead to choose the attack type" body={isLeadOrAdmin(me.role) ? 'Choose it on the Home tab.' : undefined} />
      </Screen>
    );

  const roles = [...new Set(tasks.map((t) => t.role))];
  const row = (t: Task) => {
    const locked = t.status === 'locked';
    const w = locked ? waitsFor(t) : '';
    const s = STATUS[t.status] ?? { label: t.status, variant: 'neutral' as Variant };
    return (
      <View key={t.id.toString()} style={{ gap: space.xs, opacity: locked ? 0.5 : 1, paddingVertical: space.sm }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, alignItems: 'center' }}>
          <T style={{ flex: 1, fontWeight: '600', textDecorationLine: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</T>
          <Badge label={s.label} variant={s.variant} />
        </View>
        <T variant="label">{t.assignedName}</T>
        {locked ? <T variant="label" tone="warning">{w ? `Waits for: ${w}` : 'Locked'}</T> : null}
      </View>
    );
  };

  return (
    <Screen {...header}>
      {next ? (
        <Card title="Your next step" tone="warning">
          <T variant="heading">{next.title}</T>
          <T tone="muted">{next.detail}</T>
          {err ? <T tone="danger">{err}</T> : null}
          <Button label={next.status === 'open' ? 'Accept' : 'Done'} loading={busy} onPress={() => act(next)} />
        </Card>
      ) : (
        <Card tone={mine.length ? 'success' : 'default'}>
          <T variant="heading">{mine.length ? 'Nothing to do right now' : 'No tasks for you'}</T>
          <T tone="muted">{mine.length ? 'Waiting on other steps to finish.' : `Role: ${ROLE_LABEL[me.role] ?? me.role}`}</T>
        </Card>
      )}
      <Card title="My tasks">{mine.length ? mine.map(row) : <T tone="muted">None assigned.</T>}</Card>
      <T variant="heading">Everyone's tasks</T>
      {roles.map((r) => (
        <Card key={r} title={ROLE_LABEL[r] ?? r}>{tasks.filter((t) => t.role === r).map(row)}</Card>
      ))}
    </Screen>
  );
}
