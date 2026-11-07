import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { haptics } from './haptics';
import { color, radius, space, type } from './theme';

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
    <Pressable onPress={() => press(d)} accessibilityRole="button" accessibilityLabel={d} style={({ pressed }) => [styles.key, pressed && { opacity: 0.85 }, disabled && { opacity: 0.4 }]}>
      <Text style={type.heading}>{d}</Text>
    </Pressable>
  );

  return (
    <View style={styles.wrap}>
      {title ? <Text style={type.heading}>{title}</Text> : null}
      <View style={styles.dots} accessibilityLabel={`${value.length} of ${length} digits entered`} accessibilityLiveRegion="polite">
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, i < value.length ? { backgroundColor: error ? color.dangerText : color.text, borderColor: error ? color.dangerText : color.text } : { borderColor: error ? color.dangerText : color.border }]} />
        ))}
      </View>
      <Text style={[type.label, { color: color.dangerText, minHeight: 20 }]} accessibilityRole="alert">
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
          <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Delete last digit" style={[styles.blank, { alignItems: 'center', justifyContent: 'center' }, disabled && { opacity: 0.4 }]}>
            <Text style={type.heading}>{'⌫'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md },
  dots: { flexDirection: 'row', gap: space.md },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  grid: { gap: space.md },
  gridRow: { flexDirection: 'row', gap: space.md },
  key: { width: 72, height: 72, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  blank: { width: 72, height: 72 },
});
