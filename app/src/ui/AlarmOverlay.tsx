import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Modal, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from './Button';
import { haptics } from './haptics';
import { color, font, space, type } from './theme';

export interface AlarmOverlayProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  actionLabel?: string;
  onAction: () => void;
  /** Extra content under the headline; switches to a scrolling, top-aligned layout. */
  children?: ReactNode;
}

function clockNow() {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':');
}

/** Full-screen red takeover. Field pulses and the phone vibrates on native until acknowledged. */
export function AlarmOverlay({ visible, title = 'Incident active', subtitle: sub, body, actionLabel = 'Open incident', onAction, children }: AlarmOverlayProps) {
  const subtitle = body ?? sub;
  const pulse = useRef(new Animated.Value(1)).current;
  const [stamp, setStamp] = useState(clockNow);

  useEffect(() => {
    if (!visible) return;
    setStamp(clockNow());
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    loop.start();
    let buzz: ReturnType<typeof setInterval> | undefined;
    if (Platform.OS !== 'web') {
      haptics.heavy();
      buzz = setInterval(() => haptics.warning(), 1200);
    }
    return () => {
      loop.stop();
      pulse.setValue(1);
      if (buzz) clearInterval(buzz);
    };
  }, [visible, pulse]);

  const head = (
    <>
      <View style={styles.meta}>
        <View style={styles.metaLamp} />
        <Text style={styles.metaText} maxFontSizeMultiplier={1.2}>
          Flare
        </Text>
        <Text style={styles.metaClock} maxFontSizeMultiplier={1.2}>
          {stamp}
        </Text>
      </View>
      <View style={styles.rule} />
      <Text style={[styles.big, children ? styles.bigCompact : null]} maxFontSizeMultiplier={1.2} accessibilityRole="header">
        {title}
      </Text>
      {subtitle ? (
        <Text style={styles.sub} maxFontSizeMultiplier={1.5}>
          {subtitle}
        </Text>
      ) : null}
    </>
  );

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onAction}>
      <View style={styles.root} accessibilityViewIsModal accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: pulse.interpolate({ inputRange: [0.55, 1], outputRange: [0.22, 0] }) }]} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
          {children ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
              {head}
              {children}
            </ScrollView>
          ) : (
            <View style={styles.fill}>{head}</View>
          )}
          <Button title={actionLabel} onPress={onAction} variant="alarm" />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.alarm },
  safe: { flex: 1, paddingHorizontal: space.screen + 4, paddingBottom: space.lg, gap: space.md },
  scroll: { paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  fill: { flex: 1, justifyContent: 'center', gap: space.md },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metaLamp: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#FFFFFF' },
  metaText: { flex: 1, fontFamily: font.display, fontSize: 15, lineHeight: 18, letterSpacing: 2.4, textTransform: 'uppercase', color: color.onDanger },
  metaClock: { fontFamily: font.mono, fontSize: 14, lineHeight: 18, color: color.onDanger, fontVariant: ['tabular-nums'] },
  rule: { height: 2, backgroundColor: 'rgba(255,255,255,0.85)' },
  big: { fontFamily: font.display, fontSize: 76, lineHeight: 72, letterSpacing: 0.5, textTransform: 'uppercase', color: color.onDanger, paddingTop: 6 },
  bigCompact: { fontSize: 56, lineHeight: 54 },
  sub: { ...type.body, fontSize: 19, lineHeight: 26, fontFamily: font.medium, color: color.onDanger },
});
