import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space, type } from './theme';

export interface ScreenProps {
  title?: string;
  scroll?: boolean;
  footer?: React.ReactNode;
  banner?: React.ReactNode;
  headerRight?: React.ReactNode;
  children?: React.ReactNode;
}

export function Screen({ title, scroll = true, footer, banner, headerRight, children }: ScreenProps) {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'left', 'right']}>
      {title || headerRight ? (
        <View style={styles.header}>
          <Text style={[type.heading, { flex: 1 }]} accessibilityRole="header" maxFontSizeMultiplier={1.5}>
            {title}
          </Text>
          {headerRight}
        </View>
      ) : null}
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
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.sm },
  gutter: { paddingHorizontal: space.md, paddingBottom: space.sm },
  content: { padding: space.md, gap: space.lg },
  actionBar: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border, padding: space.md, gap: space.sm },
});
