import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { color, radius, space, type, variantColor } from './theme';

export type BannerVariant = 'info' | 'success' | 'warning' | 'danger';

export function Banner({ text, variant: v, tone, actionLabel, onAction }: { text: string; variant?: BannerVariant; tone?: BannerVariant; actionLabel?: string; onAction?: () => void }) {
  const variant: BannerVariant = v ?? tone ?? 'info';
  return (
    <View
      style={styles.wrap}
      accessibilityRole={variant === 'danger' || variant === 'warning' ? 'alert' : undefined}
      accessibilityLiveRegion={variant === 'danger' ? 'assertive' : 'polite'}
    >
      <View style={[styles.bar, { backgroundColor: variantColor[variant] }]} />
      <View style={styles.body}>
        <Text style={type.body} maxFontSizeMultiplier={1.5}>
          {text}
        </Text>
        {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="ghost" fullWidth={false} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', backgroundColor: color.surface, borderRadius: radius.md, overflow: 'hidden', borderWidth: 1, borderColor: color.border },
  bar: { width: 4 },
  body: { flex: 1, padding: space.md, gap: space.xs },
});
