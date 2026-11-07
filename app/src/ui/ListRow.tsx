import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, space, type } from './theme';

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  right?: React.ReactNode;
  initials?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Avatar({ name }: { name: string }) {
  const ini = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={type.label}>{ini || '?'}</Text>
    </View>
  );
}

export function ListRow({ title, subtitle, leading, trailing, right, initials, onPress, accessibilityLabel }: ListRowProps) {
  const body = (pressed: boolean) => (
    <View style={[styles.row, pressed && { backgroundColor: color.surfaceRaised }]}>
      {initials ? <Avatar name={title} /> : leading}
      <View style={styles.mid}>
        <Text style={type.bodyStrong} maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.label} maxFontSizeMultiplier={1.5}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? right}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 64, paddingHorizontal: space.md, paddingVertical: space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border },
  mid: { flex: 1, gap: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
});
