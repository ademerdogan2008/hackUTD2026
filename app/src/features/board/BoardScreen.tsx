import { useEffect, useState } from 'react';
import { Fragment } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import type { Asset, Clock } from '../../module_bindings/types';
import { StatusStrip } from '../../components/StatusStrip';
import { canSeeCounsel, useCurrentIncident, useMe } from '../../state/hooks';
import { Badge, Button, color, font, haptics, Lamp, radius, Screen, space, T, Tag, type, variantColor, variantTint, type Variant } from '../../ui';

const STATUSES: { key: string; label: string; variant: Variant }[] = [
  { key: 'unknown', label: 'Unknown', variant: 'neutral' },
  { key: 'attacker_active', label: 'Attacker active', variant: 'danger' },
  { key: 'locked', label: 'Locked', variant: 'danger' },
  { key: 'stolen', label: 'Stolen', variant: 'danger' },
  { key: 'contained', label: 'Contained', variant: 'warning' },
  { key: 'restored', label: 'Restored', variant: 'info' },
  { key: 'safe', label: 'Safe', variant: 'success' },
];
const statusOf = (k: string) => STATUSES.find((s) => s.key === k) ?? STATUSES[0];

function remaining(deadlineMs: number, now: number) {
  const s = Math.max(0, Math.floor((deadlineMs - now) / 1000));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (s === 0) return 'Passed';
  const p = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? `${d}d ${p(h)}h ${p(m)}m` : `${p(h)}h ${p(m)}m`;
}

export default function BoardScreen() {
  const { me } = useMe();
  const { incident } = useCurrentIncident();
  const [assets] = useTable(tables.asset);
  const [clocks] = useTable(tables.clock);
  const setStatus = useReducer(reducers.setAssetStatus);
  const markFiled = useReducer(reducers.markClockFiled);
  const [picking, setPicking] = useState<Asset | null>(null);
  const [err, setErr] = useState('');
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);


  const run = async (fn: () => Promise<unknown>) => {
    setErr('');
    try {
      await fn();
      haptics.success();
    } catch (e) {
      haptics.error();
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const hot = (a: Asset) => (a.status === 'attacker_active' ? 0 : 1);
  const sortedAssets = [...assets].sort((a, b) => hot(a) - hot(b) || (a.id < b.id ? -1 : 1));
  const myClocks = incident ? clocks.filter((c) => c.incidentId === incident.id).sort((a, b) => (a.id < b.id ? -1 : 1)) : [];
  const counsel = canSeeCounsel(me?.role);

  const clockRow = (c: Clock, i: number) => {
    const filed = c.status === 'filed';
    return (
      <View key={c.id.toString()} style={[st.clock, i > 0 && st.rule, filed && { opacity: 0.55 }]}>
        <View style={st.clockHead}>
          <Text style={[type.bodyStrong, { flex: 1, textDecorationLine: filed ? 'line-through' : 'none' }]}>{c.name}</Text>
          {filed ? (
            <Badge label="Filed" variant="success" />
          ) : (
            <Text style={st.timer} accessibilityLabel={`${remaining(c.deadlineAt.toDate().getTime(), now)} left`}>
              {remaining(c.deadlineAt.toDate().getTime(), now)}
            </Text>
          )}
        </View>
        <T variant="caption" tone="muted">Possible obligation. Confirm with counsel.</T>
        {!filed ? <Button label="Mark filed" variant="secondary" onPress={() => run(() => markFiled({ clockId: c.id }))} /> : null}
      </View>
    );
  };

  const clocksFirst = counsel && myClocks.some((c) => c.status !== 'filed');

  const clocksSection = (
    <>
      <View style={st.section}>
        <Text style={type.label} accessibilityRole="header">Legal deadline clocks</Text>
        {!counsel ? (
          <T variant="callout">Legal clocks are visible to Counsel and the Incident Lead.</T>
        ) : myClocks.length === 0 ? (
          <T variant="callout">No clocks running. Marking a system with sensitive data Stolen (or Locked, for EU data) starts them.</T>
        ) : (
          <View style={st.panel}>{myClocks.map(clockRow)}</View>
        )}
      </View>
    </>
  );

  return (
    <Screen title="Board" strip={<StatusStrip />}>
      {err ? <T variant="callout" tone="danger">{err}</T> : null}
      {clocksFirst ? clocksSection : null}
      <View style={st.section}>
        <View style={st.sectionHead}>
          <Text style={type.label} accessibilityRole="header">Systems</Text>
          {sortedAssets.length ? (
            <Text style={st.tally}>{`${sortedAssets.filter((a) => a.status === 'attacker_active').length} hot · ${sortedAssets.length} total`}</Text>
          ) : null}
        </View>
        {sortedAssets.length === 0 ? (
          <T variant="callout">No systems loaded.</T>
        ) : (
          <View style={st.panel}>
            {sortedAssets.map((a, i) => {
              const s = statusOf(a.status);
              const hotRow = a.status === 'attacker_active';
              const tone = variantColor[s.variant];
              return (
                <Fragment key={a.id.toString()}>
                  <Pressable
                    onPress={() => setPicking(a)}
                    accessibilityRole="button"
                    accessibilityLabel={`${a.name}, ${s.label}. Change status`}
                    style={({ pressed }) => [st.row, i > 0 && st.rule, hotRow && { backgroundColor: variantTint.danger }, pressed && { backgroundColor: color.surfaceRaised }]}
                  >
                    <Lamp tone={tone} size={9} />
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={st.name} numberOfLines={1}>{a.name}</Text>
                      {a.hasPii ? <Text style={st.meta}>{`PII${a.regions ? ` · ${a.regions}` : ''}`}</Text> : null}
                    </View>
                    <Text style={[st.state, { color: s.variant === 'danger' ? color.dangerText : s.variant === 'neutral' ? color.textMuted : tone }]}>{s.label}</Text>
                  </Pressable>
                </Fragment>
              );
            })}
          </View>
        )}
      </View>

      {clocksFirst ? null : clocksSection}

      <Modal visible={!!picking} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <Pressable style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }} onPress={() => setPicking(null)}>
          <Pressable style={st.sheet}>
            <Text style={type.label}>Set status</Text>
            <T variant="heading">{picking?.name}</T>
            <View style={st.panel}>
              {STATUSES.map((s, i) => {
                const on = picking?.status === s.key;
                return (
                  <Pressable
                    key={s.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={s.label}
                    onPress={() => {
                      const id = picking!.id;
                      setPicking(null);
                      run(() => setStatus({ assetId: id, status: s.key }));
                    }}
                    style={({ pressed }) => [st.row, i > 0 && st.rule, on && { backgroundColor: color.surfaceRaised }, pressed && { backgroundColor: color.control }]}
                  >
                    <Lamp tone={variantColor[s.variant]} size={9} />
                    <Text style={[st.name, { flex: 1 }]}>{s.label}</Text>
                    {on ? <Tag label="Current" /> : null}
                  </Pressable>
                );
              })}
            </View>
            <Button label="Cancel" variant="ghost" onPress={() => setPicking(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const st = StyleSheet.create({
  section: { gap: space.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 2 },
  tally: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, color: color.textMuted },
  panel: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline, overflow: 'hidden' },
  row: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, paddingVertical: 10 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  name: { fontFamily: font.semibold, fontSize: 17, lineHeight: 22, color: color.text },
  meta: { fontFamily: font.mono, fontSize: 12, lineHeight: 16, color: color.info },
  state: { fontFamily: font.display, fontSize: 15, lineHeight: 18, letterSpacing: 1, textTransform: 'uppercase' },
  clock: { padding: space.md, gap: space.sm },
  clockHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  timer: { fontFamily: font.mono, fontSize: 17, lineHeight: 22, color: color.warning, fontVariant: ['tabular-nums'] },
  sheet: { backgroundColor: color.bg, borderTopWidth: 1, borderColor: color.hairline, padding: space.md, gap: space.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: space.xl },
});
