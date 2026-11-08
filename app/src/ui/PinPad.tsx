import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from './haptics';
import { color, font, radius, space, type } from './theme';

export interface PinPadProps {
  length?: number;
  value?: string;
  onChange?: (v: string) => void;
  onComplete: (v: string) => void;
  disabled?: boolean;
  error?: string | null;
  title?: string;
}

export function PinPad({ length = 6, value: valueProp, onChange: onChangeProp, onComplete, disabled, error, title }: PinPadProps) {
  const [inner, setInner] = useState('');
  const value = valueProp ?? inner;
  const onChange = onChangeProp ?? setInner;
  // Clear dots shortly after an error is shown.
  useEffect(() => {
    if (!error || !value) return;
    const t = setTimeout(() => onChange(''), 600);
    return () => clearTimeout(t);
  }, [error, value, onChange]);

  const press = (d: string) => {
    if (disabled || value.length >= length) return;
    haptics.tick();
    const next = value + d;
    onChange(next);
    if (next.length === length) onComplete(next);
  };
  const back = () => {
    if (!disabled) onChange(value.slice(0, -1));
  };

  const Key = ({ d }: { d: string }) => (
    <Pressable onPress={() => press(d)} accessibilityRole="button" accessibilityLabel={d} style={({ pressed }) => [styles.key, pressed && { backgroundColor: color.control }, disabled && { opacity: 0.4 }]}>
      <Text style={styles.digit} maxFontSizeMultiplier={1.2}>{d}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {title ? <Text style={type.heading}>{title}</Text> : null}
      <View style={styles.dots} accessibilityLabel={`${value.length} of ${length} digits entered`} accessibilityLiveRegion="polite">
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, { backgroundColor: i < value.length ? (error ? color.dangerText : color.text) : color.surfaceRaised }]} />
        ))}
      </View>
      <Text style={[type.caption, { color: color.dangerText, minHeight: 18 }]} accessibilityRole="alert">
        {error ?? ''}
      </Text>
      <View style={styles.grid}>
        {[['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9']].map((row) => (
          <View key={row[0]} style={styles.gridRow}>
            {row.map((d) => (
              <Key key={d} d={d} />
            ))}
          </View>
        ))}
        <View style={styles.gridRow}>
          <View style={styles.blank} />
          <Key d="0" />
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Delete last digit" style={({ pressed }) => [styles.blank, { alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }, disabled && { opacity: 0.4 }]}>
            <Ionicons name="backspace-outline" size={26} color={color.textSecondary} />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: 14, paddingVertical: space.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  grid: { gap: space.md },
  gridRow: { flexDirection: 'row', gap: space.lg },
  key: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: color.surface, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 28, lineHeight: 34, fontFamily: font.displaySemi, color: color.text },
  blank: { width: 72, height: 72 },
});
