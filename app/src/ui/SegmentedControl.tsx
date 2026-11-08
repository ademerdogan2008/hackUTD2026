import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius } from './theme';

export interface Segment<T extends string> {
  value: T;
  label: string;
}

/** iOS-style: surface track, raised thumb, 36px tall, no borders. */
export function SegmentedControl<T extends string>({ segments, options, value, onChange }: { segments?: Segment<T>[]; options?: { value: string; label: string }[]; value: string; onChange: (v: any) => void }) {
  return (
    <View style={styles.wrap} accessibilityRole="tablist">
      {((segments ?? options ?? []) as Segment<T>[]).map((s) => {
        const sel = s.value === value;
        return (
          <Pressable
            key={s.value}
            onPress={() => onChange(s.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: sel }}
            accessibilityLabel={s.label}
            style={({ pressed }) => [styles.seg, sel && styles.selected, pressed && !sel && { opacity: 0.7 }]}
          >
            <Text style={[styles.text, sel ? styles.textSel : null]} numberOfLines={1} maxFontSizeMultiplier={1.3}>
              {s.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.button, borderWidth: 1, borderColor: color.hairline, padding: 3, height: 40 },
  seg: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 8 },
  selected: { backgroundColor: color.control },
  text: { fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', fontFamily: font.displaySemi, color: color.textSecondary },
  textSel: { color: color.text, fontFamily: font.display },
});
