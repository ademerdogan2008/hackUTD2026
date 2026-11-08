import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { useRouter } from 'expo-router';
import { SEVERITY_LABEL, type Severity } from '@redphone/shared';
import { reducers, tables } from '../../module_bindings';
import { isLeadOrAdmin, ROLE_LABEL, useMe } from '../../state/hooks';
import { useRankedTasks } from '../../state/tasks';
import { Button, color, font, haptics } from '../../ui';
import type { Run } from './IdleView';
import type { Incident } from './PossibleView';
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

const typeLabel = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1).replace(/_/g, ' ') : 'Type pending');

/** Active / contained / recovered: status, roster, your check-in, Lead controls. */
export function LiveView({ run, incident, myRole, myHex }: { run: Run; incident: Incident; myRole?: string; myHex?: string }) {
  const [checkins] = useTable(tables.checkin);
  const { members } = useMe();
  const checkIn = useReducer(reducers.checkIn);
  const setType = useReducer(reducers.setAttackType);
  const advance = useReducer(reducers.advanceIncident);
  const staff = isLeadOrAdmin(myRole);
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
          <Text style={[tx.status, { color: st.tone, flexShrink: 1 }]} maxFontSizeMultiplier={1.3} accessibilityRole="header">
            {st.label}
          </Text>
          {incident.isDrill ? <Tag label="Drill" /> : null}
        </View>
        <Text style={tx.callout}>{typeLabel(incident.attackType)}</Text>
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

      {staff ? (
        <Section title="Lead">
          <View style={s.leadStack}>
            <Inset>
              <Row title="Attack type" trailing={<Text style={tx.callout}>{typeLabel(incident.attackType)}</Text>} />
            </Inset>

            {next ? <Button variant="primary" label={next.label} onPress={() => run(advance({ status: next.status }))} /> : null}

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
  const openTasks = () => router.push('/(tabs)/tasks' as never);
  const pct = total > 0 ? doneCount / total : 0;

  const progress =
    total > 0 ? (
      <View style={s.progressWrap}>
        <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: doneCount }}>
          <View style={[s.fill, { width: `${Math.round(pct * 100)}%` }]} />
        </View>
        <Text style={tx.caption} maxFontSizeMultiplier={1.5}>
          {doneCount} of {total} done
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

  if (!next) {
    const locked = mine.find((t) => t.status === 'locked');
    const loading = all.length === 0;
    return (
      <View style={s.card}>
        <Text style={tx.caption} accessibilityRole="header">Your next step</Text>
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

  return (
    <View style={s.card}>
      <View style={s.cardHead}>
        <Text style={tx.caption} accessibilityRole="header">Your next step</Text>
        <View style={s.sev}>
          <Dot tone={tone} />
          <Text style={[tx.caption, { color: next.severity === 'normal' ? color.textMuted : tone }]} maxFontSizeMultiplier={1.5}>
            {SEVERITY_LABEL[next.severity]}
          </Text>
        </View>
      </View>
      <Text style={s.taskTitle} maxFontSizeMultiplier={1.3}>
        {next.title}
      </Text>
      {next.detail ? (
        <Text style={tx.body} maxFontSizeMultiplier={1.5}>
          {next.detail}
        </Text>
      ) : null}
      {accepted ? <StatusText tone={color.info} label="In progress" /> : null}
      <Button variant="primary" label={accepted ? 'Mark done' : 'Accept'} onPress={act} />
      {progress}
      {link(`All tasks (${all.length})`)}
    </View>
  );
}

const s = StyleSheet.create({
  stack: { gap: 28, paddingBottom: 16 },
  header: { gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roster: { gap: 12 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.surfaceRaised, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontFamily: font.semibold, color: color.text },
  segment: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: 14, padding: 4, gap: 4 },
  option: { flex: 1, minHeight: 44, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  optionText: { fontSize: 14, lineHeight: 18, fontFamily: font.displaySemi, color: color.text, textAlign: 'center' },
  leadStack: { gap: 12 },
  card: { backgroundColor: color.surface, borderRadius: 16, padding: 20, gap: 12 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  sev: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  taskTitle: { fontSize: 22, lineHeight: 28, fontFamily: font.display, letterSpacing: -0.4, color: color.text },
  progressWrap: { gap: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: color.surfaceRaised, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2, backgroundColor: color.success },
  link: { alignSelf: 'flex-start', minHeight: 32, justifyContent: 'center' },
});
