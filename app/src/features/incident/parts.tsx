// Small presentational pieces for the Home incident views (DESIGN.md v2).
import { Children, Fragment, isValidElement } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { color } from '../../ui';

export const hairline = 'rgba(255,255,255,0.08)';
export const tertiary = '#5E5E66';

export const tx = StyleSheet.create({
  status: { fontSize: 28, lineHeight: 34, fontWeight: '600', letterSpacing: -0.4, color: color.text },
  title: { fontSize: 20, lineHeight: 25, fontWeight: '600', color: color.text },
  body: { fontSize: 17, lineHeight: 22, fontWeight: '400', color: color.text },
  bodyStrong: { fontSize: 17, lineHeight: 22, fontWeight: '600', color: color.text },
  callout: { fontSize: 15, lineHeight: 20, fontWeight: '400', color: color.textMuted },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500', color: color.textMuted },
});

export function Dot({ tone, size = 8 }: { tone: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: tone }} />;
}

/** 8px dot + label: the one status pattern. */
export function StatusText({ tone, label, style }: { tone: string; label: string; style?: StyleProp<TextStyle> }) {
  return (
    <View style={s.inline}>
      <Dot tone={tone} />
      <Text style={[tx.callout, { color: color.text }, style]} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

/** Subtle filled tag (drill, role). */
export function Tag({ label }: { label: string }) {
  return (
    <View style={s.tag}>
      <Text style={tx.caption} maxFontSizeMultiplier={1.5}>
        {label}
      </Text>
    </View>
  );
}

export function Section({ title, children, style }: { title: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[s.section, style]}>
      <Text style={[tx.caption, s.sectionTitle]} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
        {title}
      </Text>
      {children}
    </View>
  );
}

/** Inset grouped list: rows separated by hairlines inside one rounded surface. */
export function Inset({ children }: { children?: React.ReactNode }) {
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View style={s.inset}>
      {rows.map((r, i) => (
        <Fragment key={r.key ?? i}>
          {i > 0 ? <View style={s.sep} /> : null}
          {r}
        </Fragment>
      ))}
    </View>
  );
}

export function Row({
  title,
  caption,
  trailing,
  onPress,
  disabled,
  tone,
  accessibilityLabel,
}: {
  title: string;
  caption?: string;
  trailing?: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  tone?: string;
  accessibilityLabel?: string;
}) {
  const body = (pressed: boolean) => (
    <View style={[s.row, pressed && { backgroundColor: color.surfaceRaised }, disabled && { opacity: 0.45 }]}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[tx.body, tone ? { color: tone } : null]} maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {caption ? (
          <Text style={tx.caption} maxFontSizeMultiplier={1.5}>
            {caption}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );
  if (!onPress && !disabled) return body(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
    >
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

export function initialsOf(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

const s = StyleSheet.create({
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { backgroundColor: color.surfaceRaised, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'center' },
  section: { gap: 8 },
  sectionTitle: { paddingHorizontal: 4 },
  inset: { backgroundColor: color.surface, borderRadius: 16, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: hairline, marginLeft: 16 },
  row: { minHeight: 52, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
