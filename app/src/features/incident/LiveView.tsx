import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useReducer, useTable } from 'spacetimedb/react';
import { useRouter } from 'expo-router';
import { SEVERITY_LABEL, type Severity } from '@redphone/shared';
import { reducers, tables } from '../../module_bindings';
import { isLeadOrAdmin, ROLE_LABEL, useMe } from '../../state/hooks';
import { useRankedTasks } from '../../state/tasks';
import { Button, color, font, haptics, radius } from '../../ui';
import type { Run } from './IdleView';
import type { Incident } from './PossibleView';
import { attackTypeLabel } from '../jev/format';
import { EvidenceSection } from '../jev/EvidenceSection';
import { AutomationCard } from '../tasks/AutomationCard';
import { TaskDetail } from '../tasks/TaskDetail';
import { Dot, initialsOf, Inset, Row, Section, StatusText, Tag, tertiary, tx } from './parts';

const CHECKINS = [
  { state: 'here', label: "I'm here", tone: color.success },
  { state: 'unavailable', label: 'Unavailable', tone: color.warning },
  { state: 'device_affected', label: 'Device affected', tone: color.danger },
] as const;
const CHECKIN: Record<string, { label: string; tone: string }> = {
  here: { label: 'Here', tone: color.success },
  unavailable: { label: 'Unavailable', tone: color.warning },
  device_affected: { label: 'Device affected', tone: color.danger },
};
const NEXT: Record<string, { status: string; label: string }> = {
  active: { status: 'contained', label: 'Mark contained' },
  contained: { status: 'recovered', label: 'Mark recovered' },
  recovered: { status: 'closed', label: 'Close incident' },
};
const STATUS: Record<string, { label: string; tone: string }> = {
  active: { label: 'Attack active', tone: color.danger },
  contained: { label: 'Contained', tone: color.warning },
  recovered: { label: 'Recovered', tone: color.info },
};
const OTHER_TYPES = ['Account takeover / phishing', 'Data theft', 'Wire fraud', 'Unknown'];
const MAX_AVATARS = 8;
const SEVERITY_TONE: Record<Severity, string> = { critical: color.danger, high: color.warning, normal: color.textTertiary };

const typeLabel = attackTypeLabel;

/** Active / contained / recovered: status, roster, your check-in, Lead controls. */
export function LiveView({ run, incident, myRole, myHex }: { run: Run; incident: Incident; myRole?: string; myHex?: string }) {
  const [checkins] = useTable(tables.checkin);
  const { members } = useMe();
  const checkIn = useReducer(reducers.checkIn);
  const setType = useReducer(reducers.setAttackType);
  const advance = useReducer(reducers.advanceIncident);
  const staff = isLeadOrAdmin(myRole);
  // IT works the incident hands-on, so it sees the same overview as the Lead (read-only: no status controls).
  const overview = staff || myRole === 'it';
  const byMember = new Map(checkins.filter((c) => c.incidentId === incident.id).map((c) => [c.member.toHexString(), c.state]));
  const mine = byMember.get(myHex ?? '');
  const next = NEXT[incident.status];
  const st = STATUS[incident.status] ?? { label: incident.status, tone: color.textMuted };
  const shown = members.slice(0, MAX_AVATARS);

  return (
    <View style={s.stack}>
      <View style={s.header}>
        <View style={s.headRow}>
          <Dot tone={st.tone} size={10} />
          <Text style={[tx.label, { color: st.tone === color.danger ? color.dangerText : st.tone }]}>{st.label}</Text>
          {incident.isDrill ? <Tag label="Drill" /> : null}
        </View>
        <Text style={[tx.status, { fontSize: 40, lineHeight: 40 }]} maxFontSizeMultiplier={1.3} accessibilityRole="header">
          {typeLabel(incident.attackType)}
        </Text>
      </View>

      {incident.attackType ? (
        <NextStep run={run} />
      ) : incident.status === 'active' ? (
        staff ? (
          <Inset>
            <Row title="What are we facing?" caption="Pick the attack type to load the right playbook" />
            <Row
              title="Ransomware"
              tone={color.text}
              onPress={() => run(setType({ attackType: 'ransomware' }))}
              trailing={<Text style={[tx.callout, { color: color.text }]}>Select</Text>}
            />
            {OTHER_TYPES.map((l) => (
              <Row key={l} title={l} disabled trailing={<Text style={[tx.caption, { color: tertiary }]}>Soon</Text>} />
            ))}
          </Inset>
        ) : (
          <Text style={tx.callout}>Waiting for the Lead to choose the attack type</Text>
        )
      ) : null}

      <EvidenceSection incidentId={incident.id} />

      <Section title="Your status">
        <View style={s.segment}>
          {CHECKINS.map((c) => {
            const on = mine === c.state;
            return (
              <Pressable
                key={c.state}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={c.label}
                onPress={() => {
                  haptics.tick();
                  run(checkIn({ state: c.state }));
                }}
                style={({ pressed }) => [s.option, on && { backgroundColor: c.tone }, pressed && !on && { backgroundColor: color.surfaceRaised }]}
              >
                <Text style={[s.optionText, on && { color: c.state === 'device_affected' ? color.onDanger : color.onPrimary }]} maxFontSizeMultiplier={1.3}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Section>

      <View style={s.roster}>
        <Text style={tx.body}>
          {byMember.size} of {members.length} checked in
        </Text>
        <View style={s.avatars} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {shown.map((m) => {
            const state = byMember.get(m.identity.toHexString());
            const tone = state ? CHECKIN[state]?.tone : undefined;
            return (
              <View key={m.identity.toHexString()} style={[s.avatar, tone ? { borderColor: tone } : { opacity: 0.45 }]}>
                <Text style={s.avatarText}>{initialsOf(m.name)}</Text>
              </View>
            );
          })}
          {members.length > shown.length ? <Text style={tx.caption}>+{members.length - shown.length}</Text> : null}
        </View>
      </View>

      {overview ? (
        <Section title={staff ? 'Lead' : 'Incident overview'}>
          <View style={s.leadStack}>
            <Inset>
              <Row title="Attack type" trailing={<Text style={tx.callout}>{typeLabel(incident.attackType)}</Text>} />
            </Inset>

            {staff && next ? <Button variant="primary" label={next.label} onPress={() => run(advance({ status: next.status }))} /> : null}

            <Inset>
              {members.map((m) => {
                const state = byMember.get(m.identity.toHexString());
                const c = state ? CHECKIN[state] : undefined;
                return (
                  <Row
                    key={m.identity.toHexString()}
                    title={m.name}
                    caption={ROLE_LABEL[m.role] ?? m.role}
                    trailing={<StatusText tone={c?.tone ?? tertiary} label={c?.label ?? state ?? 'No response'} style={c ? undefined : { color: color.textMuted }} />}
                  />
                );
              })}
            </Inset>
          </View>
        </Section>
      ) : null}
    </View>
  );
}

/** The most important thing on Home once a playbook is loaded: your single next task. */
function NextStep({ run }: { run: Run }) {
  const router = useRouter();
  const { all, mine, next, doneCount, total } = useRankedTasks();
  const accept = useReducer(reducers.acceptTask);
  const complete = useReducer(reducers.completeTask);
  const runAutomation = useReducer(reducers.runAutomation);
  const [runs] = useTable(tables.automationRun);
  // The automation run whose result is on screen, kept until "Next step" is tapped.
  const [showing, setShowing] = useState<{ taskId: bigint; title: string } | null>(null);
  const runFor = (id: bigint) => runs.find((r) => r.taskId === id);
  const shownRun = showing ? runFor(showing.taskId) : undefined;
  const openTasks = () => router.push('/(tabs)/tasks' as never);
  const pct = total > 0 ? doneCount / total : 0;

  const progress =
    total > 0 ? (
      <View style={s.progressWrap}>
        <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: doneCount }}>
          <View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <Text style={s.count} maxFontSizeMultiplier={1.5}>
          {`${String(doneCount).padStart(2, '0')}/${String(total).padStart(2, '0')} done`}
        </Text>
      </View>
    ) : null;

  const link = (label: string) => (
    <Pressable accessibilityRole="link" accessibilityLabel={label} onPress={openTasks} hitSlop={8} style={({ pressed }) => [s.link, pressed && { opacity: 0.6 }]}>
      <Text style={[tx.callout, { color: color.text }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </Pressable>
  );

  if (showing && shownRun?.status === 'succeeded') {
    return <AutomationCard key={showing.taskId.toString()} title={showing.title} log={shownRun.log} onNext={() => setShowing(null)} />;
  }

  if (!next) {
    const locked = mine.find((t) => t.status === 'locked');
    const loading = all.length === 0;
    return (
      <View style={s.card}>
        <Text style={tx.label} accessibilityRole="header">Your next step</Text>
        <Text style={s.taskTitle} maxFontSizeMultiplier={1.3}>
          {loading ? 'Loading the playbook' : locked ? 'Nothing to do yet' : "You're clear — no open tasks"}
        </Text>
        {locked ? (
          <Text style={tx.callout}>
            {locked.waitsFor ? `Your next task unlocks when "${locked.waitsFor}" is done.` : 'Your next task unlocks when an earlier step is done.'}
          </Text>
        ) : null}
        {progress}
        {loading ? null : link(`See the team's tasks (${all.length})`)}
      </View>
    );
  }

  const tone = SEVERITY_TONE[next.severity];
  const accepted = next.status === 'accepted';
  const act = () => {
    haptics.tick();
    run(accepted ? complete({ taskId: next.id }) : accept({ taskId: next.id }));
  };
  const canAutomate = runFor(next.id)?.status === 'ready';
  const automate = () => {
    haptics.tick();
    const task = { taskId: next.id, title: next.title };
    run(runAutomation({ taskId: task.taskId }).then(() => setShowing(task)));
  };

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={tx.label} accessibilityRole="header">Your next step</Text>
        <View style={s.sev}>
          <Dot tone={tone} />
          <Text style={[tx.label, { color: next.severity === 'normal' ? color.textMuted : next.severity === 'critical' ? color.dangerText : tone }]} maxFontSizeMultiplier={1.5}>
            {SEVERITY_LABEL[next.severity]}
          </Text>
        </View>
      </View>
      <Text style={s.taskTitle} maxFontSizeMultiplier={1.3}>
        {next.title}
      </Text>
      {canAutomate ? (
        <View style={{ gap: 6 }}>
          <Button variant="primary" label="Run automatically" icon={<Ionicons name="flash" size={18} color={color.onPrimary} />} onPress={automate} />
          <Text style={tx.caption} maxFontSizeMultiplier={1.5}>Flare does these steps for you. Or follow them by hand below.</Text>
        </View>
      ) : null}
      <TaskDetail key={next.id.toString()} detail={next.detail} jev={next.stepId === 0n} checklist />
      {accepted ? <StatusText tone={color.info} label="In progress" /> : null}
      <Button variant={canAutomate ? 'secondary' : 'primary'} label={accepted ? 'Mark done' : 'Accept'} onPress={act} />
      {progress}
      {link(`All tasks (${all.length})`)}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 28, paddingBottom: 16 },
  header: { gap: 8 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roster: { gap: 12 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  avatar: { width: 34, height: 34, borderRadius: radius.sm, backgroundColor: color.surfaceRaised, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontFamily: font.display, letterSpacing: 0.4, color: color.text },
  segment: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.button, borderWidth: 1, borderColor: color.hairline, padding: 3, gap: 3 },
  option: { flex: 1, minHeight: 46, borderRadius: radius.sm + 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  optionText: { fontSize: 15, lineHeight: 18, fontFamily: font.display, letterSpacing: 0.8, textTransform: 'uppercase', color: color.text, textAlign: 'center' },
  leadStack: { gap: 12 },
  card: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline, padding: 16, gap: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingBottom: 12, marginHorizontal: -16, paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  sev: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskTitle: { fontSize: 28, lineHeight: 30, fontFamily: font.display, letterSpacing: 0.2, color: color.text },
  count: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, color: color.textMuted },
  progressWrap: { gap: 6 },
  track: { height: 6, borderRadius: 1, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 1, backgroundColor: color.success },
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
});
