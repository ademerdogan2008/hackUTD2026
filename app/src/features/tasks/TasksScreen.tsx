import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type TextStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducer, useTable } from 'spacetimedb/react';
import { SEVERITY_LABEL, type Severity } from '@redphone/shared';
import { reducers, tables } from '../../module_bindings';
import { AutomationCard } from './AutomationCard';
import { TaskDetail } from './TaskDetail';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { isLeadOrAdmin, ROLE_LABEL, useCurrentIncident, useMe } from '../../state/hooks';
import { useRankedTasks, type RankedTask } from '../../state/tasks';
import {
  Badge,
  Button,
  Card,
  color,
  EmptyState,
  font,
  haptics,
  radius,
  Screen,
  SegmentedControl,
  space,
  T,
  type,
  type Variant,
} from '../../ui';

type View_ = 'mine' | 'team';

const SEVERITIES: Severity[] = ['critical', 'high', 'normal'];
const STATUS_RANK: Record<string, number> = { accepted: 0, open: 1, locked: 2, done: 3 };

// Note: no status label reads exactly "Done" — the e2e flow clicks the hero's "Done" button by text.
const STATUS: Record<string, { label: string; variant: Variant }> = {
  open: { label: 'Open', variant: 'info' },
  accepted: { label: 'In progress', variant: 'warning' },
  done: { label: 'Completed', variant: 'success' },
  locked: { label: 'Locked', variant: 'neutral' },
};

const SEV_VARIANT: Record<Severity, Variant> = { critical: 'danger', high: 'warning', normal: 'neutral' };

/** Visual scale per severity: critical rows are the largest and carry a muted danger accent bar. */
const SEV_SCALE: Record<Severity, { title: TextStyle; accent?: string; padV: number }> = {
  critical: { title: { fontSize: 18, lineHeight: 24, fontFamily: font.display, letterSpacing: -0.3 }, accent: 'rgba(229,72,77,0.7)', padV: 14 },
  high: { title: { fontSize: 17, lineHeight: 22, fontFamily: font.semibold }, accent: 'rgba(212,161,58,0.7)', padV: 12 },
  normal: { title: { fontSize: 15, lineHeight: 20, fontFamily: font.medium }, padV: 10 },
};

const byStatusThenOrder = (a: RankedTask, b: RankedTask) => (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9) || a.order - b.order;

export default function TasksScreen() {
  const { me } = useMe();
  const { incident, ready } = useCurrentIncident();
  const { all, mine, next, doneCount, total } = useRankedTasks();
  const accept = useReducer(reducers.acceptTask);
  const complete = useReducer(reducers.completeTask);
  const askForHelp = useReducer(reducers.askForHelp);
  const runAutomation = useReducer(reducers.runAutomation);
  const [runs] = useTable(tables.automationRun);
  // The run whose result card is on screen (kept until the user taps "Next step").
  const [showing, setShowing] = useState<{ taskId: bigint; title: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [helpSent, setHelpSent] = useState<bigint | null>(null);
  const [err, setErr] = useState('');
  const [view, setView] = useState<View_>('mine');
  const [showDone, setShowDone] = useState(false);

  const list = view === 'mine' ? mine : all;
  const { sections, done } = useMemo(() => {
    const active = list.filter((t) => t.status !== 'done');
    return {
      sections: SEVERITIES.map((sev) => ({ sev, tasks: active.filter((t) => t.severity === sev).sort(byStatusThenOrder) })).filter((s) => s.tasks.length),
      done: list.filter((t) => t.status === 'done').sort((a, b) => a.order - b.order),
    };
  }, [list]);

  const act = async (t: RankedTask) => {
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

  const stuck = async (t: RankedTask) => {
    setErr('');
    try {
      await askForHelp({ taskId: t.id });
      setHelpSent(t.id);
      haptics.success();
    } catch (e) {
      haptics.error();
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const automate = async (t: RankedTask) => {
    setBusy(true);
    setErr('');
    try {
      await runAutomation({ taskId: t.id });
      setShowing({ taskId: t.id, title: t.title });
    } catch (e) {
      haptics.error();
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const runFor = (id: bigint) => runs.find((r) => r.taskId === id);
  const shownRun = showing ? runFor(showing.taskId) : undefined;

  const header = { title: 'Tasks', headerRight: <ConnectionBadge /> };
  if (!ready || !me) return <Screen {...header}><EmptyState title="Loading" /></Screen>;
  if (!incident) return <Screen {...header}><EmptyState title="No active incident" body="Tasks appear once an incident is active." /></Screen>;
  if (!incident.attackType)
    return (
      <Screen {...header}>
        <EmptyState title="Waiting for the Lead to choose the attack type" body={isLeadOrAdmin(me.role) ? 'Choose it on the Home tab.' : undefined} />
      </Screen>
    );

  const row = (t: RankedTask, i: number, scaled = true) => {
    const sev = scaled ? SEV_SCALE[t.severity] : SEV_SCALE.normal;
    const locked = t.status === 'locked';
    const isDone = t.status === 'done';
    const s = STATUS[t.status] ?? { label: t.status, variant: 'neutral' as Variant };
    return (
      <View key={t.id.toString()} style={[styles.row, i > 0 && styles.rowDivider, { paddingVertical: sev.padV }, (locked || isDone) && { opacity: 0.5 }]}>
        {sev.accent && !isDone ? <View style={[styles.accent, { backgroundColor: sev.accent }]} /> : null}
        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.rowHead}>
            <Text style={[{ color: color.text, flex: 1 }, sev.title, isDone && { textDecorationLine: 'line-through' }]} maxFontSizeMultiplier={1.5}>
              {t.title}
            </Text>
            <Badge label={s.label} variant={s.variant} />
          </View>
          {t.stepId === 0n && !isDone ? <TaskDetail detail={t.detail} jev small /> : null}
          {!isDone && runFor(t.id)?.status === 'ready' ? <T variant="caption" style={{ color: color.success }}>⚡ Can run automatically</T> : null}
          {runFor(t.id)?.status === 'succeeded' ? <T variant="caption" tone="tertiary">{`Automated by ${runFor(t.id)!.ranBy}`}</T> : null}
          {view === 'team' ? (
            <T variant="caption">
              {t.assignedName || 'Unassigned'} · {ROLE_LABEL[t.role] ?? t.role}
            </T>
          ) : null}
          {locked ? <T variant="caption" tone="tertiary">{t.waitsFor ? `Waits for: ${t.waitsFor}` : 'Waiting on an earlier step'}</T> : null}
        </View>
      </View>
    );
  };

  return (
    <Screen {...header}>
      {showing && shownRun?.status === 'succeeded' ? (
        <AutomationCard key={showing.taskId.toString()} title={showing.title} log={shownRun.log} onNext={() => setShowing(null)} />
      ) : next ? (
        <Card title="Your next step" tone="warning">
          <Badge label={SEVERITY_LABEL[next.severity]} variant={SEV_VARIANT[next.severity]} dot />
          {next.stepId === 0n ? <Badge label="From Jev · machine evidence" variant="danger" dot /> : null}
          <T variant="heading">{next.title}</T>
          {!next.assignedTo ? (
            <T variant="caption" tone="muted">{`No ${ROLE_LABEL[next.role] ?? next.role} member has joined yet, so this is yours for now.`}</T>
          ) : null}
          {runFor(next.id)?.status === 'ready' ? (
            <View style={{ gap: space.xs }}>
              <Button label="Run automatically" icon={<Ionicons name="flash" size={18} color={color.onPrimary} />} loading={busy} onPress={() => void automate(next)} />
              <T variant="caption" tone="muted">Red Phone does these steps for you. Or follow them by hand below.</T>
            </View>
          ) : null}
          <TaskDetail key={next.id.toString()} detail={next.detail} jev={next.stepId === 0n} checklist />
          {err ? <T tone="danger">{err}</T> : null}
          <Button
            label={next.status === 'open' ? 'Accept' : 'Done'}
            variant={runFor(next.id)?.status === 'ready' ? 'secondary' : 'primary'}
            loading={busy}
            onPress={() => act(next)}
          />
          {helpSent === next.id ? (
            <T variant="caption" tone="muted">Help request sent to the team chat. Someone will reach out.</T>
          ) : (
            <Button label="I'm stuck" variant="secondary" onPress={() => void stuck(next)} />
          )}
        </Card>
      ) : (
        <Card tone={total ? 'success' : 'default'}>
          <T variant="heading">{total ? (doneCount === total ? 'All your steps are complete' : 'Nothing to do right now') : 'No tasks for you'}</T>
          <T tone="muted">{total ? (doneCount === total ? 'Check the Team view for what is left.' : 'Waiting on other steps to finish.') : `Role: ${ROLE_LABEL[me.role] ?? me.role}`}</T>
        </Card>
      )}

      <SegmentedControl
        segments={[
          { value: 'mine', label: 'Mine' },
          { value: 'team', label: 'Team' },
        ]}
        value={view}
        onChange={(v: View_) => setView(v)}
      />
      {view === 'mine' && total ? <T variant="caption">{`${doneCount} of ${total} complete`}</T> : null}

      {sections.length === 0 && done.length === 0 ? (
        <T tone="muted">{view === 'mine' ? 'None assigned.' : 'No tasks yet.'}</T>
      ) : null}

      {sections.map(({ sev, tasks }) => (
        <View key={sev} style={{ gap: space.sm }}>
          <View style={styles.sectionHead} accessibilityRole="header">
            <View style={[styles.dot, { backgroundColor: SEV_SCALE[sev].accent ?? color.textTertiary }]} />
            <Text style={[type.bodyStrong, { fontFamily: font.display }]}>{SEVERITY_LABEL[sev]}</Text>
            <T variant="caption" tone="tertiary">{tasks.length}</T>
          </View>
          <View style={styles.group}>{tasks.map((t, i) => row(t, i))}</View>
        </View>
      ))}

      {done.length ? (
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() => setShowDone((v) => !v)}
            accessibilityRole="button"
            accessibilityState={{ expanded: showDone }}
            style={({ pressed }) => [styles.sectionHead, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name={showDone ? 'chevron-down' : 'chevron-forward'} size={18} color={color.textSecondary} />
            <Text style={[type.bodyStrong, { fontFamily: font.display, color: color.textSecondary }]}>{`Done (${done.length})`}</Text>
          </Pressable>
          {showDone ? <View style={styles.group}>{done.map((t, i) => row(t, i, false))}</View> : null}
        </View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: color.surface, borderRadius: radius.md, paddingHorizontal: space.md, overflow: 'hidden' },
  row: { flexDirection: 'row', gap: space.sm + 4 },
  rowDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, alignItems: 'center' },
  accent: { width: 3, borderRadius: 2, alignSelf: 'stretch' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
