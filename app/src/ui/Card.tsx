import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space, type, variantColor, variantTint } from './theme';

type CardTone = 'default' | 'danger' | 'warning' | 'success';

/** Flat surface. Tone = faint tint plus a status dot beside the title; never a border. */
export function Card({ title, footer, children, style, tone = 'default' }: { tone?: CardTone; title?: string; footer?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const toned = tone !== 'default';
  return (
    <View style={[styles.card, toned && { backgroundColor: variantTint[tone] }, style]}>
      {title ? (
        <View style={styles.head}>
          {toned ? <View style={[styles.dot, { backgroundColor: variantColor[tone] }]} /> : null}
          <Text style={[type.bodyStrong, { flex: 1 }]} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
            {title}
          </Text>
        </View>
      ) : null}
      {children}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.md, padding: space.md, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
