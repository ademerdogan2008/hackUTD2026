import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space, type } from './theme';

export function Card({ title, footer, children, style, tone = 'default' }: { tone?: 'default' | 'danger' | 'warning' | 'success'; title?: string; footer?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, tone !== 'default' && { borderColor: tone === 'danger' ? color.danger : tone === 'warning' ? color.warning : color.success, borderWidth: 2 }, style]}>
      {title ? (
        <Text style={type.heading} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
      ) : null}
      {children}
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border, padding: space.lg, gap: space.sm },
});
