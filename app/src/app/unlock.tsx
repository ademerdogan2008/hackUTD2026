import { ROLE_LABEL } from '@redphone/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useUnlock } from '../device';
import { useMe } from '../state/hooks';
import { PinPad, Screen, T } from '../ui';

export default function UnlockScreen() {
  const router = useRouter();
  const { unlock } = useUnlock();
  const { me } = useMe();
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <Screen title="Unlock">
      {me ? (
        <T tone="muted">
          {me.name} · {(ROLE_LABEL as Record<string, string>)[me.role] ?? me.role}
        </T>
      ) : null}
      <PinPad
        title="Enter your PIN"
        value={value}
        onChange={(v) => {
          setValue(v);
          if (error && v) setError(null);
        }}
        error={error}
        onComplete={async (p) => {
          if (await unlock(p)) router.replace('/(tabs)/home' as never);
          else setError('Wrong PIN');
        }}
      />
    </Screen>
  );
}
