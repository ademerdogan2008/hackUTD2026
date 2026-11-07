import { StyleSheet, Text, View } from 'react-native';
import { ROLE_LABEL_FALLBACK } from './roles';
import { color, radius, space, type, variantColor, type Variant } from './theme';

export function Badge({ label, variant: v, tone, dot }: { label: string; variant?: Variant; tone?: Variant; dot?: boolean }) {
  const variant: Variant = v ?? tone ?? 'neutral';
  const c = variant === 'neutral' ? color.text : variantColor[variant];
  return (
    <View style={[styles.pill, { borderColor: variant === 'neutral' ? color.border : c }]} accessibilityLabel={label}>
      {dot ? <View style={[styles.dot, { backgroundColor: c }]} /> : null}
      <Text style={[type.label, { color: c }]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

/** Role badge: neutral outline, admin uses info. */
export function RoleBadge({ role }: { role: string }) {
  return <Badge label={ROLE_LABEL_FALLBACK[role] ?? role} variant={role === 'admin' ? 'info' : 'neutral'} />;
}

export function StatusPill({ live, labels = ['Live', 'Reconnecting'] }: { live: boolean; labels?: [string, string] }) {
  return <Badge dot label={live ? labels[0] : labels[1]} variant={live ? 'success' : 'warning'} />;
}

const styles = StyleSheet.create({
  pill: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: space.xs, paddingHorizontal: space.sm, borderRadius: radius.pill, borderWidth: 1, alignSelf: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
