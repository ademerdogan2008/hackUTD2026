import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useReducer, useSpacetimeDB } from 'spacetimedb/react';
import { sha256Hex, signJoin } from '@redphone/shared';
import { SPACETIME_DB } from '../config';
import { getOrCreateDeviceKey } from '../device';
import { reducers } from '../module_bindings';
import { useMe } from '../state/hooks';
import { Banner, Button, Card, Field, radius, Screen, space, T } from '../ui';


function parseSecret(raw: string): string | null {
  const s = raw.trim().replace(/^(flare|redphone):/i, '').trim();
  return /^[0-9a-f]{16,}$/i.test(s) ? s.toLowerCase() : null;
}

export default function JoinScreen() {
  const router = useRouter();
  const { identity } = useSpacetimeDB();
  const { me, members, ready } = useMe();
  const redeemInvite = useReducer(reducers.redeemInvite);
  const bootstrapAdmin = useReducer(reducers.bootstrapAdmin);
  const [perm, requestPerm] = useCameraPermissions();
  const [text, setText] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const locked = useRef(false);
  const meRef = useRef(me);
  meRef.current = me;

  useEffect(() => {
    if (me) router.replace('/pin' as never);
  }, [me, router]);

  const waitForMe = async () => {
    const end = Date.now() + 6000;
    while (Date.now() < end) {
      if (meRef.current) return true;
      await new Promise((r) => setTimeout(r, 150));
    }
    return false;
  };

  const redeem = async (raw: string) => {
    const secretHex = parseSecret(raw);
    if (!secretHex) {
      setError('That does not look like a Flare invite code.');
      locked.current = false;
      return;
    }
    if (!identity) {
      setError('Not connected yet. Try again in a moment.');
      locked.current = false;
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { secretKey, publicKeyHex } = await getOrCreateDeviceKey();
      const sigHex = signJoin(secretKey, sha256Hex(secretHex), identity.toHexString());
      await redeemInvite({ secretHex, pubkeyHex: publicKeyHex, sigHex });
      if (!(await waitForMe())) setError('Timed out waiting for the server. Check your connection and try again.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      locked.current = false;
    }
  };

  const bootstrap = async () => {
    if (!name.trim()) {
      setError('Enter your name.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const { publicKeyHex } = await getOrCreateDeviceKey();
      await bootstrapAdmin({ name: name.trim(), pubkeyHex: publicKeyHex });
      if (!(await waitForMe())) setError('Timed out waiting for the server.');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const canCamera = Platform.OS !== 'web';

  return (
    <Screen title="Join Flare">
      <T tone="muted">Scan the QR code from your incident lead, or paste the invite code.</T>
      <T variant="caption" tone="muted">Database: {SPACETIME_DB}</T>
      {error ? <Banner variant="danger" text={error} /> : null}

      {canCamera ? (
        scanning && perm?.granted ? (
          <View style={styles.camWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (locked.current || busy) return;
                locked.current = true;
                setScanning(false);
                void redeem(data);
              }}
            />
          </View>
        ) : (
          <Button
            title="Scan QR code"
            disabled={busy}
            onPress={async () => {
              if (!perm?.granted) {
                const r = await requestPerm();
                if (!r.granted) {
                  setError('Camera permission denied. Paste the code instead.');
                  return;
                }
              }
              locked.current = false;
              setScanning(true);
            }}
          />
        )
      ) : null}

      <Card>
        <Field label="Invite code" value={text} onChangeText={setText} autoCapitalize="none" placeholder="flare:..." editable={!busy} />
        <Button title="Join" loading={busy} disabled={!text.trim()} onPress={() => void redeem(text)} />
      </Card>

      {ready && members.length === 0 ? (
        <Card>
          <T variant="heading">Set up as first admin</T>
          <T tone="muted">No members yet. Create the organization admin on this device.</T>
          <Field label="Your name" value={name} onChangeText={setName} editable={!busy} />
          <Button title="Create admin" variant="secondary" loading={busy} onPress={() => void bootstrap()} />
        </Card>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  camWrap: { height: 320, borderRadius: radius.md, overflow: 'hidden', marginBottom: space.sm },
});
