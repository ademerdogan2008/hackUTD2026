import { useEffect, useRef } from 'react';
import { Animated, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { haptics } from './haptics';
import { color, space, type } from './theme';

export interface AlarmOverlayProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  body?: string;
  actionLabel?: string;
  onAction: () => void;
}

/** Full-screen red alarm. Pulses and vibrates on native until dismissed. */
export function AlarmOverlay({ visible, title = 'INCIDENT ACTIVE', subtitle: sub, body, actionLabel = 'Open incident', onAction }: AlarmOverlayProps) {
  const subtitle = body ?? sub;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.55, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(pulse, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
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
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#FF2A1A', opacity: pulse.interpolate({ inputRange: [0.55, 1], outputRange: [0.35, 0] }) }]} />
        <View style={styles.center}>
          <Text style={styles.big} maxFontSizeMultiplier={1.3}>
            {title}
          </Text>
          {subtitle ? <Text style={[type.body, { color: color.onDanger, textAlign: 'center' }]}>{subtitle}</Text> : null}
        </View>
        <View style={styles.bar}>
          <Button title={actionLabel} onPress={onAction} variant="primary" />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.danger, padding: space.md, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  big: { ...type.display, color: color.onDanger, textAlign: 'center' },
  bar: { paddingBottom: space.xl },
});
