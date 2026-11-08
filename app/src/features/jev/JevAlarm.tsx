import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import { isLeadOrAdmin, useMe } from '../../state/hooks';
import { AlarmOverlay, Button, color, font, haptics, radius, space, type } from '../../ui';
import { acknowledgeIncident } from '../incident/GlobalAlarm';
import { evidenceLines, jevHeadline, localTime, pageLabel, splitEvidence } from './format';
import { ALARM_DECISIONS, notifyOnce, useJevTriage } from './state';

// Device-local acks, shared across mounts.
const acked = new Set<string>();
const later = new Set<string>();
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

/** Jev high-confidence takeover (all phones) and the mid-confidence review sheet (assigned reviewer only). */
export function JevAlarm() {
  useSyncExternalStore(subscribe, () => version);
  const router = useRouter();
  const { me, identityHex } = useMe();
  const { rows, ready, fresh } = useJevTriage();
  const [hits] = useTable(tables.tripwireHit);
  const [tasks] = useTable(tables.task);
  const checkIn = useReducer(reducers.checkIn);

  const alarm = useMemo(
    () =>
      ready && me
        ? rows
            .filter((r) => ALARM_DECISIONS.has(r.decision) && fresh(r) && !acked.has(r.id.toString()))
            .sort((a, b) => (a.id > b.id ? -1 : 1))[0]
        : undefined,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, ready, me, version],
  );

  const review = useMemo(() => {
    if (!ready || !me) return undefined;
    const staff = isLeadOrAdmin(me.role);
    return rows
      .filter((r) => r.decision === 'pending' && !later.has(r.id.toString()) && (r.reviewer ? r.reviewer === identityHex : staff))
      .sort((a, b) => (a.id > b.id ? -1 : 1))[0];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, ready, me, identityHex, version]);

  // Keep the generic incident alarm quiet for the incident Jev is announcing.
  const alarmId = alarm?.id;
  const alarmIncident = alarm?.incidentId;
  useEffect(() => {
    if (alarmId === undefined) return;
    notifyOnce(`jev-${alarmId.toString()}`);
  }, [alarmId]);

  const reviewId = review?.id;
  useEffect(() => {
    if (reviewId === undefined) return;
    haptics.warning();
    notifyOnce(`jev-review-${reviewId.toString()}`);
  }, [reviewId]);

  const hit = alarm ? hits.find((h) => h.id === alarm.hitId) : undefined;
  const system = hit?.systemName || alarm?.scope.split(',')[0]?.trim() || '';
  const when = alarm ? localTime(alarm.at) : '';
  const myTasks = alarm
    ? tasks
        .filter((t) => t.incidentId === alarm.incidentId && t.assignedTo === identityHex && (t.status === 'open' || t.status === 'accepted'))
        .sort((a, b) => (a.id < b.id ? -1 : 1))
    : [];

  const onContinue = () => {
    if (!alarm) return;
    acked.add(alarm.id.toString());
    if (alarmIncident !== undefined && alarmIncident !== 0n) {
      acknowledgeIncident(alarmIncident);
      checkIn({ state: 'here' }).catch(() => {});
    }
    emit();
    router.navigate('/(tabs)/home' as never);
  };

  return (
    <>
      <AlarmOverlay
        visible={!!alarm}
        title="ATTACKER ACTIVE"
        subtitle={[system && `in ${system}`, when].filter(Boolean).join(' · ')}
        actionLabel="Review evidence & continue"
        onAction={onContinue}
      >
        {alarm ? (
          <>
            <View style={s.card}>
              <Text style={s.headline} maxFontSizeMultiplier={1.3}>
                {jevHeadline(alarm.probability, alarm.incidentType)}
              </Text>
              {alarm.scope ? <Text style={s.line}>Scope: {alarm.scope.split(',').map((x) => x.trim()).filter(Boolean).join(', ')}</Text> : null}
              {alarm.page ? <Text style={s.line}>Paging: {pageLabel(alarm.page)}</Text> : null}
              <MachineTag />
              {evidenceLines(alarm.evidence).map((l, i) => (
                <View key={i} style={s.evRow}>
                  <Text style={s.evNum}>{i + 1}.</Text>
                  <Text style={[s.line, { flex: 1 }]}>{l}</Text>
                </View>
              ))}
            </View>
            {myTasks.length ? (
              <View style={s.card}>
                <Text style={s.kicker}>YOUR NEXT STEPS</Text>
                {myTasks.map((t, i) => {
                  const { action, evidence } = splitEvidence(t.detail);
                  return (
                    <View key={t.id.toString()} style={s.evRow}>
                      <Text style={s.evNum}>{i + 1}.</Text>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={s.taskTitle}>{t.title}</Text>
                        {action ? <Text style={s.line}>{action}</Text> : null}
                        {evidence ? <Text style={[s.line, { opacity: 0.75 }]}>Evidence: {evidence}</Text> : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}
          </>
        ) : null}
      </AlarmOverlay>
      {!alarm && review ? <ReviewSheet triage={review} /> : null}
    </>
  );
}

export function MachineTag({ dark }: { dark?: boolean }) {
  return (
    <View style={[s.tag, dark && s.tagDark]}>
      <Text style={[s.tagText, dark && { color: color.dangerText }]} maxFontSizeMultiplier={1.4}>
        Machine evidence · tripwire
      </Text>
    </View>
  );
}

type Triage = NonNullable<ReturnType<typeof useJevTriage>['rows'][number]>;

function ReviewSheet({ triage }: { triage: Triage }) {
  const confirm = useReducer(reducers.confirmTriage);
  const dismiss = useReducer(reducers.dismissTriage);
  const [busy, setBusy] = useState<'' | 'confirm' | 'dismiss'>('');
  const [err, setErr] = useState('');
  const id = triage.id;

  const act = async (which: 'confirm' | 'dismiss') => {
    setBusy(which);
    setErr('');
    try {
      if (which === 'confirm') await confirm({ triageId: id });
      else await dismiss({ triageId: id });
      haptics.success();
    } catch (e) {
      haptics.error();
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  };
  const close = () => {
    later.add(id.toString());
    emit();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={close}>
      <View style={s.scrim}>
        <View style={s.sheet}>
          <ScrollView contentContainerStyle={{ gap: space.sm }}>
            <Text style={[type.caption, { color: color.warning }]}>JEV NEEDS A HUMAN</Text>
            <Text style={type.title}>Jev needs a human · {jevHeadline(triage.probability, triage.incidentType).replace(/^Jev · /, '')}</Text>
            {triage.scope ? <Text style={type.callout}>Scope: {triage.scope}</Text> : null}
            <MachineTag dark />
            {evidenceLines(triage.evidence).map((l, i) => (
              <View key={i} style={s.evRow}>
                <Text style={[type.callout, { color: color.textTertiary }]}>{i + 1}.</Text>
                <Text style={[type.callout, { color: color.text, flex: 1 }]}>{l}</Text>
              </View>
            ))}
            {err ? <Text style={[type.callout, { color: color.dangerText }]}>{err}</Text> : null}
          </ScrollView>
          <Button label="Confirm attack" variant="danger" loading={busy === 'confirm'} disabled={!!busy} onPress={() => act('confirm')} />
          <Button label="Dismiss as false alarm" variant="secondary" loading={busy === 'dismiss'} disabled={!!busy} onPress={() => act('dismiss')} />
          <Pressable onPress={close} accessibilityRole="button" style={({ pressed }) => [s.later, pressed && { opacity: 0.6 }]}>
            <Text style={type.callout}>Decide later</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: 'rgba(0,0,0,0.26)', borderRadius: radius.md, padding: space.md, gap: space.sm },
  headline: { fontFamily: font.display, fontSize: 22, lineHeight: 28, color: color.onDanger },
  kicker: { fontFamily: font.display, fontSize: 12, letterSpacing: 2, color: color.onDanger, opacity: 0.8 },
  line: { fontFamily: font.regular, fontSize: 15, lineHeight: 21, color: color.onDanger },
  taskTitle: { fontFamily: font.semibold, fontSize: 16, lineHeight: 22, color: color.onDanger },
  evRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  evNum: { fontFamily: font.semibold, fontSize: 15, lineHeight: 21, color: color.onDanger, opacity: 0.75, minWidth: 18 },
  tag: { alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: radius.pill, paddingVertical: 2, paddingHorizontal: 10 },
  tagDark: { borderColor: color.danger },
  tagText: { fontFamily: font.semibold, fontSize: 12, lineHeight: 16, color: color.onDanger },
  scrim: { flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' },
  sheet: { backgroundColor: color.surface, padding: space.md, gap: space.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: space.xl, maxHeight: '85%' },
  later: { alignSelf: 'center', minHeight: 40, justifyContent: 'center' },
});
