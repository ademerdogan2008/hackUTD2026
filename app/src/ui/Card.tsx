import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Lamp } from './Lamp';
import { color, radius, space, type, variantColor, variantTint } from './theme';

type CardTone = 'default' | 'danger' | 'warning' | 'success';

/** Console panel: flat surface, hairline edge. Tone = faint tint, tinted edge, lamp beside the title. */
export function Card({ title, footer, children, style, tone = 'default' }: { tone?: CardTone; title?: string; footer?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const toned = tone !== 'default';
  return (
    <View style={[styles.card, toned && { backgroundColor: variantTint[tone], borderColor: `${variantColor[tone]}55` }, style]}>
      {title ? (
        <View style={styles.head}>
          {toned ? <Lamp tone={variantColor[tone]} size={8} /> : null}
          <Text style={[type.title, { flex: 1 }]} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
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
  card: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline, padding: space.md, gap: space.sm },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
