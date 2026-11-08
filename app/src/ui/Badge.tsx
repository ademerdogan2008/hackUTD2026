import { StyleSheet, Text, View } from 'react-native';
import { Lamp } from './Lamp';
import { ROLE_LABEL_FALLBACK } from './roles';
import { color, font, radius, variantColor, type Variant } from './theme';

/** Status = lamp + condensed caps label in the lamp's hue. Neutral without `dot` renders as a plate tag. */
export function Badge({ label, variant: v, tone, dot }: { label: string; variant?: Variant; tone?: Variant; dot?: boolean }) {
  const variant: Variant = v ?? tone ?? 'neutral';
  if (variant === 'neutral' && !dot) return <Tag label={label} />;
  const c = variant === 'danger' ? color.dangerText : variant === 'neutral' ? color.textSecondary : variantColor[variant];
  return (
    <View style={styles.status} accessibilityLabel={label}>
      <Lamp tone={variantColor[variant]} size={7} />
      <Text style={[styles.statusText, { color: c }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

/** Small rectangular plate: drill, role, region. */
export function Tag({ label, strong }: { label: string; strong?: boolean }) {
  return (
    <View style={[styles.tag, strong && { borderColor: color.textSecondary }]} accessibilityLabel={label}>
      <Text style={[styles.tagText, strong && { color: color.text }]} maxFontSizeMultiplier={1.4}>
        {label}
      </Text>
    </View>
  );
}

export function RoleBadge({ role }: { role: string }) {
  return <Tag label={ROLE_LABEL_FALLBACK[role] ?? role} strong={role === 'admin' || role === 'lead'} />;
}

export function StatusPill({ live, labels = ['Live', 'Reconnecting'] }: { live: boolean; labels?: [string, string] }) {
  return <Badge dot label={live ? labels[0] : labels[1]} variant={live ? 'success' : 'warning'} />;
}

const styles = StyleSheet.create({
  status: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  statusText: { fontFamily: font.displaySemi, fontSize: 14, lineHeight: 18, letterSpacing: 0.8, textTransform: 'uppercase' },
  tag: { paddingVertical: 2, paddingHorizontal: 7, borderRadius: radius.sm - 2, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.surfaceRaised, alignSelf: 'flex-start' },
  tagText: { fontFamily: font.displaySemi, fontSize: 12, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase', color: color.textSecondary },
});
