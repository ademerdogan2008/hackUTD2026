import { useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, TextInput, View } from 'react-native';
import { useReducer, useTable } from 'spacetimedb/react';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { Bubble, type ChatMsg } from '../../features/chat/Bubble';
import { reducers, tables } from '../../module_bindings';
import { canSeeCounsel, useMe, useMemberNames } from '../../state/hooks';
import { Button, EmptyState, Screen, SegmentedControl, color, radius, space, type } from '../../ui';

type Channel = 'all' | 'counsel';

export default function ChatTab() {
  const { me, identityHex } = useMe();
  const names = useMemberNames();
  const showCounsel = canSeeCounsel(me?.role);
  const [channel, setChannel] = useState<Channel>('all');
  const [allRows] = useTable(tables.allMessages);
  const [counselRows] = useTable(tables.counselMessages);
  const sendMessage = useReducer(reducers.sendMessage);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const list = useRef<FlatList<ChatMsg>>(null);

  const active: Channel = showCounsel ? channel : 'all';
  const msgs = useMemo<ChatMsg[]>(() => {
    const rows = active === 'all' ? allRows : counselRows;
    return [...rows]
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
      .map((r) => {
        const hex = r.author.toHexString();
        return { id: r.id, authorHex: hex, authorName: r.authorName, role: names.get(hex)?.role, body: r.body, at: r.at.toDate() };
      });
  }, [active, allRows, counselRows, names]);

  useEffect(() => {
    const t = setTimeout(() => list.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [msgs.length, active]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      await sendMessage({ channel: active, body });
      setText('');
    } catch (e) {
      console.warn('send failed', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen title="Chat" headerRight={<ConnectionBadge />} scroll={false}>
      <KeyboardAvoidingView style={{ flex: 1, gap: space.sm }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {showCounsel ? (
          <SegmentedControl
            segments={[
              { value: 'all', label: 'All' },
              { value: 'counsel', label: 'Counsel — privileged' },
            ]}
            value={active}
            onChange={setChannel}
          />
        ) : null}
        <FlatList
          ref={list}
          style={{ flex: 1, marginHorizontal: -space.md }}
          data={msgs}
          keyExtractor={(m) => m.id.toString()}
          renderItem={({ item }) => <Bubble m={item} mine={item.authorHex === identityHex} />}
          ListEmptyComponent={<EmptyState title="No messages yet" body="Say something to the team." />}
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: false })}
          keyboardShouldPersistTaps="handled"
        />
        <View style={styles.composer}>
          <TextInput
            style={styles.input}
            value={text}
            onChangeText={setText}
            placeholder={active === 'counsel' ? 'Privileged message' : 'Message'}
            placeholderTextColor={color.textMuted}
            accessibilityLabel="Message"
            multiline
            onSubmitEditing={send}
          />
          <Button label="Send" onPress={send} loading={sending} disabled={!text.trim()} fullWidth={false} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm },
  input: { flex: 1, minHeight: 56, maxHeight: 120, backgroundColor: color.surfaceRaised, borderRadius: radius.lg, paddingHorizontal: space.md, color: color.text, ...type.body },
});
