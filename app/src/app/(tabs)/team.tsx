import { Alert, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useReducer } from 'spacetimedb/react';
import { ROLES, canInvite, fingerprint, type Role } from '@redphone/shared';
import { ConnectionBadge } from '../../components/ConnectionBadge';
import { reducers } from '../../module_bindings';
import { ROLE_LABEL, useMe, useMemberNames } from '../../state/hooks';
import { Button, Card, EmptyState, ListRow, RoleBadge, Screen, T } from '../../ui';

export default function TeamTab() {
  const router = useRouter();
  const { me, members } = useMe();
  const names = useMemberNames();
  const resetDemo = useReducer(reducers.resetDemo);

  const canInviteAny = !!me && ROLES.some((r) => canInvite(me.role as Role, r));

  const confirmReset = () => {
    const run = () => void resetDemo().catch((e: unknown) => console.warn('reset failed', e));
    if (Platform.OS === 'web') {
      if (window.confirm('Reset demo? This wipes all demo data.')) run();
    } else {
      Alert.alert('Reset demo?', 'This wipes all demo data.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: run },
      ]);
    }
  };

  const sorted = [...members].sort((a, b) => (a.joinedAt.microsSinceUnixEpoch < b.joinedAt.microsSinceUnixEpoch ? -1 : 1));

  return (
    <Screen title="Team" headerRight={<ConnectionBadge />}>
      {me ? (
        <Card title={me.name}>
          <View style={{ flexDirection: 'row' }}>
            <RoleBadge role={me.role} />
          </View>
          <T variant="label">Your key fingerprint</T>
          <T variant="mono">{fingerprint(me.pubkeyHex)}</T>
          <T variant="label" tone="muted">Compare in person</T>
        </Card>
      ) : null}

      {canInviteAny ? <Button label="Invite someone" onPress={() => router.push('/invite' as never)} /> : null}
      <Button label="Audit timeline" variant="secondary" onPress={() => router.push('/audit' as never)} />

      <View>
        {sorted.length === 0 ? <EmptyState title="No members" /> : null}
        {sorted.map((m) => {
          const by = m.invitedBy ? names.get(m.invitedBy)?.name : undefined;
          return (
            <ListRow
              key={m.identity.toHexString()}
              initials
              title={m.name}
              subtitle={`${fingerprint(m.pubkeyHex)}${by ? `\ninvited by ${by}` : ''}`}
              trailing={<RoleBadge role={m.role} />}
              accessibilityLabel={`${m.name}, ${ROLE_LABEL[m.role] ?? m.role}`}
            />
          );
        })}
      </View>

      {me ? <Button label="Reset demo" variant="danger" onPress={confirmReset} /> : null}
    </Screen>
  );
}
