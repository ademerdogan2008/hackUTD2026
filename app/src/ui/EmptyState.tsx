import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { space, type } from './theme';

/** One line + muted subline, centered. `glyph` is accepted for compatibility but not drawn (no illustrations). */
export function EmptyState({ title, body, actionLabel, onAction }: { title: string; body?: string; glyph?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={[type.bodyStrong, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.callout, { textAlign: 'center' }]}>{body}</Text> : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} variant="ghost" fullWidth={false} style={{ alignSelf: 'center' }} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', gap: space.xs, paddingVertical: space.xl, paddingHorizontal: space.md } });
