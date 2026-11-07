import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space, type } from './theme';

export function Card({ title, footer, children, style }: { title?: string; footer?: React.ReactNode; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[styles.card, style]}>
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
