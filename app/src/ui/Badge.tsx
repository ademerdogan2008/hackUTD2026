import { StyleSheet, Text, View } from 'react-native';
import { ROLE_LABEL_FALLBACK } from './roles';
import { color, radius, type, variantColor, type Variant } from './theme';

/** Status = 8px dot + caption. Neutral without `dot` renders as a subtle filled tag. */
export function Badge({ label, variant: v, tone, dot }: { label: string; variant?: Variant; tone?: Variant; dot?: boolean }) {
  const variant: Variant = v ?? tone ?? 'neutral';
  if (variant === 'neutral' && !dot) return <Tag label={label} />;
  return (
    <View style={styles.status} accessibilityLabel={label}>
      <View style={[styles.dot, { backgroundColor: variantColor[variant] }]} />
      <Text style={[type.caption, variant === 'danger' && { color: color.dangerText }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

function Tag({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <View style={styles.tag} accessibilityLabel={label}>
      <Text style={[type.caption, strong && { color: color.text }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

/** Role badge: subtle filled pill. */
export function RoleBadge({ role }: { role: string }) {
  return <Tag label={ROLE_LABEL_FALLBACK[role] ?? role} strong={role === 'admin'} />;
}

export function StatusPill({ live, labels = ['Live', 'Reconnecting'] }: { live: boolean; labels?: [string, string] }) {
  return <Badge dot label={live ? labels[0] : labels[1]} variant={live ? 'success' : 'warning'} />;
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  tag: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: radius.pill, backgroundColor: color.surfaceRaised, alignSelf: 'flex-start' },
});
