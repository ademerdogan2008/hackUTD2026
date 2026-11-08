import { StyleSheet, Text, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { reducers, tables } from '../../module_bindings';
import { isLeadOrAdmin, useCurrentIncident, useMemberNames } from '../../state/hooks';
import { Button, color } from '../../ui';
import type { Run } from './IdleView';
import { Dot, Tag, tx } from './parts';

export type Incident = NonNullable<ReturnType<typeof useCurrentIncident>['incident']>;

/** Possible attack: one status block, one primary action, false alarm as a quiet escape. */
export function PossibleView({ run, incident, myRole, myHex }: { run: Run; incident: Incident; myRole?: string; myHex?: string }) {
  const [reports] = useTable(tables.alertReport);
  const names = useMemberNames();
  const raise = useReducer(reducers.raiseAlert);
  const confirm = useReducer(reducers.confirmAlert);
  const dismiss = useReducer(reducers.dismissAlert);
  const mine = reports.filter((r) => r.incidentId === incident.id);
  const reported = mine.some((r) => r.reporter.toHexString() === myHex);
  const isRaiser = incident.raisedBy.toHexString() === myHex;
  const raiser = isRaiser ? 'you' : names.get(incident.raisedBy.toHexString())?.name ?? 'a teammate';
  const staff = isLeadOrAdmin(myRole);
  const canConfirm = staff && !isRaiser;

  return (
    <View style={s.fill}>
      <View style={s.block}>
        <View style={s.head}>
          <Dot tone={color.warning} size={10} />
          <Text style={[tx.status, { color: color.warning, flexShrink: 1 }]} maxFontSizeMultiplier={1.3}>
            Possible attack
          </Text>
          {incident.isDrill ? <Tag label="Drill" /> : null}
        </View>
        <Text style={tx.callout} maxFontSizeMultiplier={1.5}>
          Reported by {raiser} · {mine.length} report{mine.length === 1 ? '' : 's'}
        </Text>
      </View>

      <View style={s.actions}>
        {canConfirm ? (
          <Button variant="danger" label="Confirm attack" onPress={() => run(confirm())} />
        ) : !reported ? (
          <Button variant="danger" label="I see it too" onPress={() => run(raise({ isDrill: incident.isDrill }))} />
        ) : (
          <View style={s.wait}>
            <Text style={[tx.callout, s.centerText]}>Waiting for a Lead to confirm or a second report</Text>
            {staff ? <Text style={[tx.caption, s.centerText]}>A different Lead or Admin must confirm your report.</Text> : null}
          </View>
        )}
        {staff ? <Button variant="ghost" label="False alarm" onPress={() => run(dismiss())} /> : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'space-between', gap: 28 },
  block: { backgroundColor: color.surface, borderRadius: 16, padding: 20, gap: 8 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  actions: { gap: 4, paddingBottom: 8 },
  wait: { gap: 4, paddingVertical: 12 },
  centerText: { textAlign: 'center' },
});
