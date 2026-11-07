import { fingerprint, ROLE_LABEL } from '@redphone/shared';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { getOrCreateDeviceKey, setPin, useUnlock } from '../device';
import { useMe } from '../state/hooks';
import { Card, PinPad, Screen, T } from '../ui';

export default function SetPINScreen() {
  const router = useRouter();
  const { markUnlocked } = useUnlock();
  const { me } = useMe();
  const [value, setValue] = useState('');
  const [first, setFirst] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fp, setFp] = useState('');

  useEffect(() => {
    getOrCreateDeviceKey().then((k) => setFp(fingerprint(k.publicKeyHex)));
  }, []);

  const complete = async (pin: string) => {
    if (first === null) {
      setFirst(pin);
      setValue('');
      return;
    }
    if (pin !== first) {
      setError('PINs do not match. Start over.');
      setFirst(null);
      return;
    }
    await setPin(pin);
    markUnlocked();
    router.replace('/(tabs)/home' as never);
  };

  return (
    <Screen title="Set your PIN">
      {me ? (
        <T tone="muted">
          {me.name} · {(ROLE_LABEL as Record<string, string>)[me.role] ?? me.role}
        </T>
      ) : null}
      <PinPad
        title={first === null ? 'Choose a 6-digit PIN' : 'Confirm your PIN'}
        value={value}
        onChange={(v) => {
          setValue(v);
          if (error && v) setError(null);
        }}
        error={error}
        onComplete={(p) => void complete(p)}
      />
      <Card>
        <T variant="label" tone="muted">Your key fingerprint</T>
        <T variant="mono">{fp || '…'}</T>
      </Card>
    </Screen>
  );
}
