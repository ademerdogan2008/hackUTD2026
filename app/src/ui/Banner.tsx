import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { color, font, radius, space, type, variantColor } from './theme';

export type BannerVariant = 'info' | 'success' | 'warning' | 'danger';

const icon: Record<BannerVariant, React.ComponentProps<typeof Ionicons>['name']> = {
  info: 'information-circle',
  success: 'checkmark-circle',
  warning: 'warning',
  danger: 'alert-circle',
};

/** Compact inline notice: left icon, text, optional text action. No border. */
export function Banner({ text, variant: v, tone, actionLabel, onAction }: { text: string; variant?: BannerVariant; tone?: BannerVariant; actionLabel?: string; onAction?: () => void }) {
  const variant: BannerVariant = v ?? tone ?? 'info';
  const c = variantColor[variant];
  return (
    <View
      style={styles.wrap}
      accessibilityRole={variant === 'danger' || variant === 'warning' ? 'alert' : undefined}
      accessibilityLiveRegion={variant === 'danger' ? 'assertive' : 'polite'}
    >
      <Ionicons name={icon[variant]} size={18} color={c} style={{ marginTop: 1 }} />
      <Text style={[type.callout, styles.text]} maxFontSizeMultiplier={1.5}>
        {text}
      </Text>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" accessibilityLabel={actionLabel} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.7 }}>
          <Text style={[type.callout, { color: c, fontFamily: font.semibold }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: color.surface, borderWidth: 1, borderColor: color.hairline, borderRadius: radius.button, paddingVertical: 12, paddingHorizontal: 14 },
  text: { flex: 1, color: color.text },
});
