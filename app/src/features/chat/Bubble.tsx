import { StyleSheet, View } from 'react-native';
import { ROLE_LABEL } from '@redphone/shared';
import { T, color, radius, space } from '../../ui';

export interface ChatMsg {
  id: bigint;
  authorHex: string;
  authorName: string;
  role?: string;
  body: string;
  at: Date;
}

export function Bubble({ m, mine }: { m: ChatMsg; mine: boolean }) {
  const time = m.at.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return (
    <View style={[styles.row, mine ? styles.right : styles.left]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        {!mine ? (
          <T variant="label">
            {m.authorName}
            {m.role ? ` · ${(ROLE_LABEL as Record<string, string>)[m.role] ?? m.role}` : ''}
          </T>
        ) : null}
        <T style={mine ? { color: color.onPrimary } : undefined}>{m.body}</T>
        <T variant="label" style={[styles.time, mine && { color: color.bg }]}>{time}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: space.md, marginVertical: space.xs },
  right: { justifyContent: 'flex-end' },
  left: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: radius.md, paddingVertical: space.sm, paddingHorizontal: space.md },
  mine: { backgroundColor: color.primary },
  theirs: { backgroundColor: color.surfaceRaised },
  time: { fontSize: 12, lineHeight: 16, alignSelf: 'flex-end' },
});
