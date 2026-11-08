import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space, type } from './theme';

export interface ScreenProps {
  title?: string;
  scroll?: boolean;
  footer?: React.ReactNode;
  banner?: React.ReactNode;
  headerRight?: React.ReactNode;
  right?: React.ReactNode;
  children?: React.ReactNode;
}

/** Large left-aligned title, optional right accessory, content, optional pinned footer action. */
export function Screen({ title, scroll = true, footer, banner, headerRight: hr, right, children }: ScreenProps) {
  const headerRight = right ?? hr;
  const header =
    title || headerRight ? (
      <View style={styles.header}>
        <Text style={[type.largeTitle, { flex: 1 }]} accessibilityRole="header" numberOfLines={1} maxFontSizeMultiplier={1.3}>
          {title}
        </Text>
        {headerRight ? <View style={styles.right}>{headerRight}</View> : null}
      </View>
    ) : null;
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {header}
      {banner ? <View style={styles.gutter}>{banner}</View> : null}
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }]}>{children}</View>
      )}
      {footer ? <View style={styles.actionBar}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: color.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.screen, paddingTop: space.md, paddingBottom: space.sm },
  right: { flexShrink: 0, alignItems: 'flex-end' },
  gutter: { paddingHorizontal: space.screen, paddingBottom: space.sm },
  content: { paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: space.screen, gap: space.section },
  actionBar: { backgroundColor: color.bg, paddingHorizontal: space.screen, paddingTop: space.sm, paddingBottom: space.md, gap: space.sm },
});
