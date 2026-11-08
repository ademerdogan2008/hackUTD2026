import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getRandomBytes } from 'expo-crypto';
import { bytesToHex } from '@noble/hashes/utils.js';
import { useReducer, useTable } from 'spacetimedb/react';
import { ROLES, canInvite, sha256Hex, type Role } from '@redphone/shared';
import { SPACETIME_DB } from '../config';
import { getOrCreateDeviceKey } from '../device';
import { reducers, tables } from '../module_bindings';
import { ROLE_LABEL, useMe } from '../state/hooks';
import { Badge, Button, Countdown, Field, QRPanel, Screen, T, mono, type } from '../ui';

const TTL_MS = 10 * 60 * 1000;

interface Created {
  secretHex: string;
  secretHash: string;
  expiresAt: number;
}

/** DEMO ONLY: visiting /invite without being a member joins this device as an admin. */
function DemoJoinAdmin() {
  const router = useRouter();
  const { me } = useMe();
  const join = useReducer(reducers.demoJoinAdmin);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (me) router.replace('/pin' as never);
  }, [me, router]);

  const go = async () => {
    if (!name.trim()) {
      setErr('Enter your name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const { publicKeyHex } = await getOrCreateDeviceKey();
      await join({ name: name.trim(), pubkeyHex: publicKeyHex });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Screen
      title="Join as admin"
      footer={<Button label="Join as admin" onPress={() => void go()} loading={busy} disabled={!name.trim()} />}
    >
      <T tone="muted">Demo mode: this device joins Red Phone as an admin.</T>
      <T variant="caption" tone="muted">Database: {SPACETIME_DB}</T>
      <Field label="Your name" value={name} onChangeText={setName} placeholder="Your name" autoCapitalize="words" />
      {err ? <T tone="danger">{err}</T> : null}
    </Screen>
  );
}

export default function InviteScreen() {
  const { me, ready } = useMe();
  if (ready && !me) return <DemoJoinAdmin />;
  return <CreateInvite />;
}

function CreateInvite() {
  const router = useRouter();
  const { me } = useMe();
  const createInvite = useReducer(reducers.createInvite);
  const [invites] = useTable(tables.invite);
  const roles = me ? ROLES.filter((r) => canInvite(me.role as Role, r)) : [];
  const [role, setRole] = useState<string>('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [created, setCreated] = useState<Created | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!role && roles.length) setRole(roles[0]);
  }, [role, roles]);

  const used = created ? invites.some((i) => i.secretHash === created.secretHash && i.used) : false;

  const show = async () => {
    if (!role || !name.trim()) {
      setErr('Pick a role and enter a name.');
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      const secretHex = bytesToHex(getRandomBytes(32));
      const secretHash = sha256Hex(secretHex);
      await createInvite({ role, name: name.trim(), secretHash });
      setExpired(false);
      setCreated({ secretHex, secretHash, expiresAt: Date.now() + TTL_MS });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const code = created ? `redphone:${created.secretHex}` : '';
  if (!created) {
    return (
      <Screen
        title="Invite"
        footer={<Button label="Show QR" onPress={show} loading={busy} disabled={!role || !name.trim()} />}
      >
        {roles.length === 0 ? <T tone="muted">Your role cannot invite anyone.</T> : null}
        <View style={{ gap: 8 }}>
          <T variant="label">Role</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {roles.map((r) => (
              <Pressable key={r} onPress={() => setRole(r)} accessibilityRole="radio" accessibilityState={{ selected: role === r }}>
                <Badge label={ROLE_LABEL[r] ?? r} variant={role === r ? 'info' : 'neutral'} />
              </Pressable>
            ))}
          </View>
        </View>
        <Field label="Name" value={name} onChangeText={setName} placeholder="Their name" autoCapitalize="words" />
        {err ? <T tone="danger">{err}</T> : null}
      </Screen>
    );
  }

  return (
    <Screen title="Invite" footer={<Button label="Done" onPress={() => (router.canGoBack() ? router.back() : router.replace('/team' as never))} />}>
      <T variant="label" style={{ textAlign: 'center' }}>
        {name.trim()} · {ROLE_LABEL[role] ?? role}
      </T>
      <QRPanel value={code} expired={expired || used} label="Invite QR code. Show it to the person joining." />
      {used ? (
        <View style={{ alignItems: 'center' }}>
          <Badge variant="success" label="Joined" />
        </View>
      ) : (
        <Countdown expiresAt={created.expiresAt} onExpire={() => setExpired(true)} />
      )}
      <T variant="label" style={{ textAlign: 'center' }}>Or paste this code (long-press to copy)</T>
      <Text selectable style={{ ...type.body, fontFamily: mono, fontSize: 13, lineHeight: 18 }}>{code}</Text>
    </Screen>
  );
}
