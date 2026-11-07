import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { GlobalAlarm } from '../../features/incident/GlobalAlarm';
import { reducers, tables } from '../../module_bindings';
import { isLeadOrAdmin, ROLE_LABEL, useCurrentIncident, useMe, useMemberNames } from '../../state/hooks';
import { Badge, Banner, Button, Card, color, haptics, ListRow, radius, Screen, space, T, type } from '../../ui';

const CHECKINS = [
  { state: 'here', label: "I'm here", tone: color.success },
  { state: 'unavailable', label: 'Unavailable', tone: color.warning },
  { state: 'device_affected', label: 'Device hit', tone: color.dangerText },
] as const;
const CHECKIN_LABEL: Record<string, string> = { here: 'Here', unavailable: 'Unavailable', device_affected: 'Device affected' };
const NEXT: Record<string, { status: string; label: string }> = {
  active: { status: 'contained', label: 'Mark contained' },
  contained: { status: 'recovered', label: 'Mark recovered' },
  recovered: { status: 'closed', label: 'Close incident' },
};
const STATUS_TEXT: Record<string, string> = { active: 'ATTACK ACTIVE', contained: 'CONTAINED', recovered: 'RECOVERED' };

export default function HomeTab() {
  const { me, ready: meReady } = useMe();
  const { incident } = useCurrentIncident();
  const [error, setError] = useState<string | null>(null);

  const run = async (p: Promise<unknown>) => {
    setError(null);
    try {
      await p;
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen title="Home" headerRight={<ConnectionBadge />} banner={error ? <Banner variant="danger" text={error} actionLabel="Dismiss" onAction={() => setError(null)} /> : undefined}>
      <GlobalAlarm />
      {!meReady ? null : !incident ? <Idle run={run} /> : incident.status === 'possible' ? (
        <Possible run={run} incident={incident} myRole={me?.role} myHex={me?.identity.toHexString()} />
      ) : (
        <Live run={run} incident={incident} myRole={me?.role} myHex={me?.identity.toHexString()} />
      )}
    </Screen>
  );
}

type Run = (p: Promise<unknown>) => Promise<void>;
type Incident = NonNullable<ReturnType<typeof useCurrentIncident>['incident']>;

function Idle({ run }: { run: Run }) {
  const raise = useReducer(reducers.raiseAlert);
  const [drill, setDrill] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <>
      <Card tone="success">
        <T variant="heading" tone="success">All clear</T>
        <T tone="muted">No active incident. If something looks wrong, hit the button. Do not wait.</T>
      </Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={drill ? 'Start drill' : 'Possible attack'}
        disabled={busy}
        onPress={async () => {
          haptics.heavy();
          setBusy(true);
          await run(raise({ isDrill: drill }));
          setBusy(false);
        }}
        style={({ pressed }) => [styles.big, drill && { backgroundColor: color.warning }, pressed && { transform: [{ scale: 0.97 }] }, busy && { opacity: 0.6 }]}
      >
        <Text style={styles.bigIcon}>{drill ? '◎' : '!'}</Text>
        <Text style={styles.bigText}>{drill ? 'Start drill' : 'Possible attack'}</Text>
        <Text style={styles.bigSub}>{drill ? 'Practice run. Nobody gets hurt.' : 'Tap to alert your Incident Lead'}</Text>
      </Pressable>
      <Button variant={drill ? 'primary' : 'secondary'} label={drill ? 'Drill mode ON (tap to switch off)' : 'Drill mode'} onPress={() => setDrill(!drill)} />
    </>
  );
}

function Possible({ run, incident, myRole, myHex }: { run: Run; incident: Incident; myRole?: string; myHex?: string }) {
  const [reports] = useTable(tables.alertReport);
  const names = useMemberNames();
  const raise = useReducer(reducers.raiseAlert);
  const confirm = useReducer(reducers.confirmAlert);
  const dismiss = useReducer(reducers.dismissAlert);
  const mine = reports.filter((r) => r.incidentId === incident.id);
  const reported = mine.some((r) => r.reporter.toHexString() === myHex);
  const isRaiser = incident.raisedBy.toHexString() === myHex;
  const raiser = names.get(incident.raisedBy.toHexString())?.name ?? 'a teammate';
  const staff = isLeadOrAdmin(myRole);
  return (
    <>
      <Card tone="warning">
        <View style={styles.row}>
          {incident.isDrill ? <Badge label="DRILL" variant="warning" /> : null}
          <Badge label={`${mine.length} report${mine.length === 1 ? '' : 's'}`} variant="warning" />
        </View>
        <T variant="display" tone="warning">Possible attack</T>
        <T>Reported by {isRaiser ? 'you' : raiser}.</T>
        <T tone="muted">{reported ? 'Waiting for a Lead to confirm or a second report.' : 'Seeing something too? A second report confirms it.'}</T>
      </Card>
      {!reported ? <Button variant="danger" label="I see it too" onPress={() => run(raise({ isDrill: incident.isDrill }))} /> : null}
      {staff && !isRaiser ? (
        <>
          <Button variant="danger" label="Confirm attack" onPress={() => run(confirm())} />
          <Button variant="secondary" label="False alarm" onPress={() => run(dismiss())} />
        </>
      ) : null}
      {staff && isRaiser ? <T tone="muted">A different Lead or Admin must confirm your report. You can still mark it a false alarm.</T> : null}
      {staff && isRaiser ? <Button variant="secondary" label="False alarm" onPress={() => run(dismiss())} /> : null}
    </>
  );
}

function Live({ run, incident, myRole, myHex }: { run: Run; incident: Incident; myRole?: string; myHex?: string }) {
  const [checkins] = useTable(tables.checkin);
  const { members } = useMe();
  const checkIn = useReducer(reducers.checkIn);
  const setType = useReducer(reducers.setAttackType);
  const advance = useReducer(reducers.advanceIncident);
  const staff = isLeadOrAdmin(myRole);
  const cs = checkins.filter((c) => c.incidentId === incident.id);
  const byMember = new Map(cs.map((c) => [c.member.toHexString(), c.state]));
  const mine = byMember.get(myHex ?? '');
  const next = NEXT[incident.status];
  const hot = incident.status === 'active';
  const accent = hot ? color.danger : incident.status === 'contained' ? color.warning : color.success;
  const counts = { here: 0, unavailable: 0, device_affected: 0 } as Record<string, number>;
  byMember.forEach((s) => (counts[s] = (counts[s] ?? 0) + 1));

  return (
    <>
      <View style={[styles.hero, { backgroundColor: hot ? color.danger : color.surface, borderColor: accent }]}>
        <View style={styles.row}>
          {incident.isDrill ? <Badge label="DRILL" variant="warning" /> : null}
          <Badge label={incident.attackType ? incident.attackType.toUpperCase() : 'TYPE UNSET'} variant={hot ? 'neutral' : 'info'} />
        </View>
        <Text style={[type.display, { color: hot ? color.onDanger : accent }]} maxFontSizeMultiplier={1.3}>
          {STATUS_TEXT[incident.status] ?? incident.status.toUpperCase()}
        </Text>
        <Text style={[type.body, { color: hot ? color.onDanger : color.textMuted }]}>
          {byMember.size} of {members.length} checked in
        </Text>
      </View>

      {staff && !incident.attackType && incident.status === 'active' ? (
        <Card title="What are we facing?">
          <Button label="Ransomware" onPress={() => run(setType({ attackType: 'ransomware' }))} />
          {['Phishing / BEC', 'Data breach', 'DDoS'].map((l) => (
            <Button key={l} variant="secondary" disabled label={`${l} (coming soon)`} onPress={() => {}} />
          ))}
        </Card>
      ) : null}

      <Card title="Your status">
        <View style={styles.row}>
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
                style={[styles.ci, on && { backgroundColor: c.tone, borderColor: c.tone }]}
              >
                <Text style={[type.bodyStrong, { textAlign: 'center', color: on ? color.onPrimary : color.text }]} maxFontSizeMultiplier={1.3}>
                  {c.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {staff ? (
        <Card title="Team presence">
          <View style={styles.row}>
            <Badge dot label={`${counts.here} here`} variant="success" />
            <Badge dot label={`${counts.unavailable} away`} variant="warning" />
            <Badge dot label={`${counts.device_affected} hit`} variant="danger" />
          </View>
          <View style={styles.list}>
            {members.map((m) => {
              const s = byMember.get(m.identity.toHexString());
              return (
                <ListRow
                  key={m.identity.toHexString()}
                  initials
                  title={m.name}
                  subtitle={ROLE_LABEL[m.role] ?? m.role}
                  trailing={<Badge label={s ? CHECKIN_LABEL[s] ?? s : 'No response'} variant={s === 'here' ? 'success' : s === 'unavailable' ? 'warning' : s ? 'danger' : 'neutral'} />}
                />
              );
            })}
          </View>
        </Card>
      ) : null}

      {staff && next ? <Button variant={hot ? 'primary' : 'secondary'} label={next.label} onPress={() => run(advance({ status: next.status }))} /> : null}
    </>
  );
}

const styles = StyleSheet.create({
  big: { backgroundColor: color.danger, borderRadius: radius.lg, minHeight: 280, alignItems: 'center', justifyContent: 'center', gap: space.sm, padding: space.lg },
  bigIcon: { fontSize: 72, lineHeight: 80, fontWeight: '800', color: color.onDanger },
  bigText: { ...type.display, color: color.onDanger, textAlign: 'center' },
  bigSub: { ...type.body, color: color.onDanger, opacity: 0.85, textAlign: 'center' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  hero: { borderRadius: radius.lg, borderWidth: 2, padding: space.lg, gap: space.sm, minHeight: 200, justifyContent: 'center' },
  ci: { flexGrow: 1, flexBasis: 90, minHeight: 88, borderRadius: radius.md, borderWidth: 2, borderColor: color.border, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center', padding: space.sm },
  list: { marginHorizontal: -space.lg, marginBottom: -space.lg, overflow: 'hidden', borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
});
