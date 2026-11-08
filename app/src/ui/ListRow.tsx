import { Ionicons } from '@expo/vector-icons';
import { Children, createContext, Fragment, isValidElement, useContext } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { color, radius, space, type } from './theme';

const InGroup = createContext(false);

export interface ListRowProps {
  title: string;
  subtitle?: string;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  right?: React.ReactNode;
  initials?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
}

export function Avatar({ name }: { name: string }) {
  const ini = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('');
  return (
    <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Text style={[type.label, { color: color.text, letterSpacing: 0.4 }]}>{ini || '?'}</Text>
    </View>
  );
}

/**
 * Inside <Group>: transparent inset row, Group draws hairlines.
 * Standalone (e.g. inside a Card): flush row with its own hairline under it.
 */
export function ListRow({ title, subtitle, leading, trailing, right, initials, onPress, accessibilityLabel }: ListRowProps) {
  const grouped = useContext(InGroup);
  const body = (pressed: boolean) => (
    <View style={[styles.row, grouped ? styles.grouped : styles.flush, pressed && { opacity: 0.7 }]}>
      {initials ? <Avatar name={title} /> : leading}
      <View style={styles.mid}>
        <Text style={type.body} numberOfLines={2} maxFontSizeMultiplier={1.5}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={type.callout} maxFontSizeMultiplier={1.5}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing ?? right}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={color.textTertiary} /> : null}
    </View>
  );
  if (!onPress) return body(false);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(', ')}>
      {({ pressed }) => body(pressed)}
    </Pressable>
  );
}

/** Inset grouped list: one rounded surface, rows separated by hairlines. */
export function Group({ title, footer, children, style }: { title?: string; footer?: string; children?: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const items = Children.toArray(children).filter(isValidElement);
  return (
    <View style={[{ gap: space.sm }, style]}>
      {title ? (
        <Text style={[type.label, styles.groupLabel]} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.group}>
        <InGroup.Provider value>
          {items.map((child, i) => (
            <Fragment key={child.key ?? i}>
              {i > 0 ? <View style={styles.sep} /> : null}
              {child}
            </Fragment>
          ))}
        </InGroup.Provider>
      </View>
      {footer ? <Text style={[type.caption, styles.groupLabel, { color: color.textTertiary }]}>{footer}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: space.md - 4 },
  grouped: { paddingHorizontal: space.md, paddingVertical: 12 },
  flush: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: color.hairline },
  mid: { flex: 1, gap: 2 },
  avatar: { width: 32, height: 32, borderRadius: radius.sm, borderWidth: 1, borderColor: color.hairline, backgroundColor: color.surfaceRaised, alignItems: 'center', justifyContent: 'center' },
  group: { backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.hairline, overflow: 'hidden' },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: color.hairline, marginLeft: space.md },
  groupLabel: { paddingHorizontal: space.md },
});
