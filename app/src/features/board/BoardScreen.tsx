import { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import type { Asset, Clock } from '../../module_bindings/types';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { canSeeCounsel, useCurrentIncident, useMe } from '../../state/hooks';
import { Badge, Button, Card, color, haptics, radius, Screen, space, T, type Variant } from '../../ui';

const STATUSES: { key: string; label: string; variant: Variant }[] = [
  { key: 'unknown', label: 'Unknown', variant: 'neutral' },
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
  if (s === 0) return 'Deadline passed';
  return d > 0 ? `${d}d ${h}h ${m}m left` : `${h}h ${m}m left`;
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

  const sortedAssets = [...assets].sort((a, b) => (a.id < b.id ? -1 : 1));
  const myClocks = incident ? clocks.filter((c) => c.incidentId === incident.id).sort((a, b) => (a.id < b.id ? -1 : 1)) : [];
  const counsel = canSeeCounsel(me?.role);

  const clockRow = (c: Clock) => {
    const filed = c.status === 'filed';
    return (
      <View key={c.id.toString()} style={{ gap: space.xs, paddingVertical: space.sm, opacity: filed ? 0.5 : 1 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
          <T style={{ flex: 1, fontWeight: '600', textDecorationLine: filed ? 'line-through' : 'none' }}>{c.name}</T>
          {filed ? <Badge label="Filed" variant="success" /> : <Badge label={remaining(c.deadlineAt.toDate().getTime(), now)} variant="warning" />}
        </View>
        <T variant="label">Possible obligation — confirm with counsel</T>
        {!filed ? <Button label="Mark filed" variant="secondary" onPress={() => run(() => markFiled({ clockId: c.id }))} /> : null}
      </View>
    );
  };

  return (
    <Screen title="Board" headerRight={<ConnectionBadge />}>
      {err ? <T tone="danger">{err}</T> : null}
      <T variant="heading">Systems</T>
      {sortedAssets.length === 0 ? <T tone="muted">No systems loaded.</T> : null}
      {sortedAssets.map((a) => {
        const s = statusOf(a.status);
        return (
          <Pressable key={a.id.toString()} onPress={() => setPicking(a)} accessibilityRole="button" accessibilityLabel={`${a.name}, ${s.label}. Change status`}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: space.sm }}>
                <T style={{ flex: 1, fontWeight: '600' }}>{a.name}</T>
                <Badge label={s.label} variant={s.variant} />
              </View>
              {a.hasPii ? <View style={{ flexDirection: 'row' }}><Badge label={`PII${a.regions ? ` · ${a.regions}` : ''}`} variant="info" /></View> : null}
            </Card>
          </Pressable>
        );
      })}

      <T variant="heading">Legal deadline clocks</T>
      {!counsel ? (
        <T tone="muted">Legal clocks are visible to Counsel and the Incident Lead.</T>
      ) : myClocks.length === 0 ? (
        <T tone="muted">No clocks running. Marking a PII system Stolen starts them.</T>
      ) : (
        <Card>{myClocks.map(clockRow)}</Card>
      )}

      <Modal visible={!!picking} transparent animationType="slide" onRequestClose={() => setPicking(null)}>
        <Pressable style={{ flex: 1, backgroundColor: color.scrim, justifyContent: 'flex-end' }} onPress={() => setPicking(null)}>
          <Pressable style={{ backgroundColor: color.surface, padding: space.md, gap: space.sm, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, paddingBottom: space.xl }}>
            <T variant="heading">{picking?.name}</T>
            {STATUSES.map((s) => (
              <Button
                key={s.key}
                label={s.label}
                variant={picking?.status === s.key ? 'primary' : 'secondary'}
                onPress={() => {
                  const id = picking!.id;
                  setPicking(null);
                  run(() => setStatus({ assetId: id, status: s.key }));
                }}
              />
            ))}
            <Button label="Cancel" variant="ghost" onPress={() => setPicking(null)} />
          </Pressable>
        </Pressable>
      </Modal>
    </Screen>
  );
}
