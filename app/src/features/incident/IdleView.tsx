import { useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { useReducer } from 'spacetimedb/react';
import { reducers } from '../../module_bindings';
import { useMe } from '../../state/hooks';
import { color, font, haptics } from '../../ui';
import { Dot, tx } from './parts';

export type Run = (p: Promise<unknown>) => Promise<void>;

/** All clear: calm centered state, big red button pinned to the bottom. */
export function IdleView({ run }: { run: Run }) {
  const raise = useReducer(reducers.raiseAlert);
  const { members } = useMe();
  const [drill, setDrill] = useState(false);
  const [busy, setBusy] = useState(false);
  const toggle = () => {
    haptics.tick();
    setDrill((d) => !d);
  };
  return (
    <View style={s.fill}>
      <View style={s.center}>
        <View style={s.statusRow}>
          <Dot tone={color.success} size={12} />
          <Text style={[tx.status, { color: color.success }]} accessibilityRole="header" maxFontSizeMultiplier={1.3}>
            All clear
          </Text>
        </View>
        <Text style={tx.callout}>No active incident</Text>
        <View style={s.standby}>
          <Text style={s.standbyNum} maxFontSizeMultiplier={1.3}>
            {String(members.length).padStart(2, '0')}
          </Text>
          <Text style={[tx.callout, { flex: 1 }]} maxFontSizeMultiplier={1.5}>
            responders on standby. One tap reaches all of their phones.
          </Text>
        </View>
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
        <Text style={[tx.caption, { textAlign: 'center' }]}>{drill ? 'Starts a practice run for the whole team' : 'Alerts your Incident Lead first'}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', gap: 8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  standby: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20, paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: color.hairline },
  standbyNum: { fontFamily: font.mono, fontSize: 28, lineHeight: 32, color: color.text },
  bottom: { gap: 12, paddingBottom: 8 },
  drillRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 2, minHeight: 48 },
  big: { height: 76, borderRadius: 12, backgroundColor: color.danger, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  bigText: { fontSize: 26, lineHeight: 30, fontFamily: font.display, letterSpacing: 2, textTransform: 'uppercase', color: color.onDanger },
  bigTag: { fontSize: 13, lineHeight: 16, fontFamily: font.displaySemi, letterSpacing: 1.2, textTransform: 'uppercase', color: color.onDanger, borderWidth: 1, borderColor: 'rgba(255,255,255,0.7)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1 },
});
