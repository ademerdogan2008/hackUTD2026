import { useSpacetimeDB } from 'spacetimedb/react';
import { StyleSheet, Text, View } from 'react-native';
import { useConnectionStatus } from '../spacetime/SpacetimeRoot';

export function ConnectionBadge({ ready }: { ready: boolean }) {
  const { isActive } = useSpacetimeDB();
  const { phase } = useConnectionStatus();
  const live = isActive && phase === 'connected' && ready;
  const label = live ? 'Live' : 'Reconnecting…';
  return (
    <View
      style={[styles.pill, { backgroundColor: live ? '#1f9d55' : '#d9822b' }]}
      accessibilityLabel={label}
    >
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  text: { color: 'white', fontWeight: '700', fontSize: 13 },
});
