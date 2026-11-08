import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../../module_bindings';
import { color, haptics } from '../../ui';
import { StatusText, tx } from './parts';

export type Run = (p: Promise<unknown>) => Promise<void>;

/** All clear: calm centered state, big red button pinned to the bottom. */
export function IdleView({ run }: { run: Run }) {
  const raise = useReducer(reducers.raiseAlert);
  const [drill, setDrill] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = () => {
    haptics.tick();
    setDrill((d) => !d);
  };
  return (
    <View style={s.fill}>
      <View style={s.center}>
        <StatusText tone={color.success} label="All clear" style={tx.title} />
        <Text style={tx.callout}>No active incident</Text>
      </View>

      <View style={s.bottom}>
        <Pressable accessibilityRole="switch" accessibilityLabel="Drill mode" accessibilityState={{ checked: drill }} onPress={toggle} style={s.drillRow}>
          <View style={{ flex: 1 }}>
            <Text style={tx.body}>Drill mode</Text>
            <Text style={tx.caption}>Practice run for the whole team</Text>
          </View>
          <View pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <Switch value={drill} trackColor={{ false: color.surfaceRaised, true: color.warning }} thumbColor={color.text} />
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Possible attack"
          accessibilityHint={drill ? 'Starts a drill' : 'Alerts your Incident Lead'}
          disabled={busy}
          onPress={async () => {
            haptics.heavy();
            setBusy(true);
            await run(raise({ isDrill: drill }));
            setBusy(false);
          }}
          style={({ pressed }) => [s.big, pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] }, busy && { opacity: 0.6 }]}
        >
          <Text style={s.bigText} maxFontSizeMultiplier={1.3}>
            Possible attack
          </Text>
          {drill ? <Text style={s.bigTag}>Drill</Text> : null}
        </Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  bottom: { gap: 12, paddingBottom: 8 },
  drillRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4, minHeight: 48 },
  big: { height: 64, borderRadius: 18, backgroundColor: color.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  bigText: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: color.onDanger },
  bigTag: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: color.onDanger, opacity: 0.75 },
});
