import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, radius, space, type } from './theme';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

export function SegmentedControl<T extends string>({ segments, value, onChange }: { segments: Segment<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {segments.map((s) => {
        const sel = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={s.label}
            style={[styles.seg, sel && styles.selected]}
          >
            <Text style={[type.bodyStrong, { color: sel ? color.text : color.textMuted }]}>{s.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.lg, padding: space.xs, borderWidth: 1, borderColor: color.border },
  seg: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, borderWidth: 2, borderColor: 'transparent' },
  selected: { backgroundColor: color.surfaceRaised, borderColor: color.text },
});
