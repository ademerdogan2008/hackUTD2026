import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, type ReactNode } from 'react';
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

/** Full-screen red alarm. Pulses and vibrates on native until dismissed. */
export function AlarmOverlay({ visible, title = 'INCIDENT ACTIVE', subtitle: sub, body, actionLabel = 'Open incident', onAction, children }: AlarmOverlayProps) {
  const subtitle = body ?? sub;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
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

  return (
    <Modal visible={visible} animationType="fade" transparent={false} statusBarTranslucent onRequestClose={onAction}>
      <View style={styles.root} accessibilityViewIsModal accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: pulse.interpolate({ inputRange: [0.55, 1], outputRange: [0.18, 0] }) }]} />
        <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
          {children ? (
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
              <View style={styles.headRow}>
                <Ionicons name="warning" size={28} color={color.onDanger} accessibilityElementsHidden />
                <Text style={[styles.kicker, { marginTop: 0 }]} maxFontSizeMultiplier={1.3}>
                  RED PHONE
                </Text>
              </View>
              <Text style={[styles.big, { textAlign: 'left' }]} maxFontSizeMultiplier={1.3}>
                {title}
              </Text>
              {subtitle ? (
                <Text style={[styles.sub, { textAlign: 'left', maxWidth: undefined }]} maxFontSizeMultiplier={1.5}>
                  {subtitle}
                </Text>
              ) : null}
              {children}
            </ScrollView>
          ) : (
          <View style={styles.center}>
            <Ionicons name="warning" size={64} color={color.onDanger} accessibilityElementsHidden />
            <Text style={styles.kicker} maxFontSizeMultiplier={1.3}>
              RED PHONE
            </Text>
            <Text style={styles.big} maxFontSizeMultiplier={1.3}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.sub} maxFontSizeMultiplier={1.5}>
                {subtitle}
              </Text>
            ) : null}
          </View>
          )}
          <Button title={actionLabel} onPress={onAction} variant="primary" />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.alarm },
  safe: { flex: 1, paddingHorizontal: space.screen, paddingBottom: space.lg },
  scroll: { paddingTop: space.lg, paddingBottom: space.lg, gap: space.md },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  kicker: { fontFamily: font.display, fontSize: 13, lineHeight: 16, letterSpacing: 3, color: color.onDanger, opacity: 0.8, marginTop: space.sm },
  big: { fontFamily: font.display, fontSize: 40, lineHeight: 44, letterSpacing: -0.8, color: color.onDanger, textAlign: 'center' },
  sub: { ...type.body, color: color.onDanger, opacity: 0.9, textAlign: 'center', maxWidth: 320 },
});
