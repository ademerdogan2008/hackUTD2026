import { StyleSheet, Text, View } from 'react-native';
import { Button } from './Button';
import { color, space, type } from './theme';

export function EmptyState({ title, body, glyph = '○', actionLabel, onAction }: { title: string; body?: string; glyph?: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.wrap}>
      <Text style={{ fontSize: 48, color: color.textMuted }} accessibilityElementsHidden>
        {glyph}
      </Text>
      <Text style={[type.heading, { textAlign: 'center' }]}>{title}</Text>
      {body ? <Text style={[type.body, { color: color.textMuted, textAlign: 'center' }]}>{body}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="ghost" fullWidth={false} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { alignItems: 'center', gap: space.sm, padding: space.xl } });
