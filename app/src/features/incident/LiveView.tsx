import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import { isLeadOrAdmin, ROLE_LABEL, useMe } from '../../state/hooks';
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

      {staff ? (
        <Section title="Lead">
          <View style={s.leadStack}>
            {!incident.attackType && incident.status === 'active' ? (
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
              <Inset>
                <Row title="Attack type" trailing={<Text style={tx.callout}>{typeLabel(incident.attackType)}</Text>} />
              </Inset>
            )}

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

const s = StyleSheet.create({
  stack: { gap: 28, paddingBottom: 16 },
  header: { gap: 6 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  roster: { gap: 12 },
  avatars: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.surfaceRaised, borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 12, fontFamily: font.semibold, color: color.text },
  segment: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: 14, padding: 4, gap: 4 },
  option: { flex: 1, minHeight: 52, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, paddingVertical: 8 },
  optionText: { fontSize: 15, lineHeight: 19, fontFamily: font.display, color: color.text, textAlign: 'center' },
  leadStack: { gap: 12 },
});
