import { StyleSheet, View } from 'react-native';
import { ROLE_LABEL } from '@redphone/shared';
import { T, color, font, radius, space, type } from '../../ui';

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
          <T variant="label" style={{ color: color.text }}>
            {m.authorName}
            {m.role ? <T variant="label">{` · ${(ROLE_LABEL as Record<string, string>)[m.role] ?? m.role}`}</T> : null}
          </T>
        ) : null}
        <T>{m.body}</T>
        <T style={styles.time}>{time}</T>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', paddingHorizontal: space.md, marginVertical: space.xs },
  right: { justifyContent: 'flex-end' },
  left: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '84%', borderRadius: radius.md, borderWidth: 1, paddingVertical: space.sm, paddingHorizontal: 14, gap: 3 },
  mine: { backgroundColor: '#13283A', borderColor: 'rgba(79,179,232,0.35)', borderBottomRightRadius: 3 },
  theirs: { backgroundColor: color.surface, borderColor: color.hairline, borderBottomLeftRadius: 3 },
  time: { ...type.caption, fontFamily: font.mono, fontSize: 11, lineHeight: 14, color: color.textTertiary, alignSelf: 'flex-end' },
});
