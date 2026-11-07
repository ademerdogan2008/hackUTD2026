import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useSpacetimeDB } from 'spacetimedb/react';
import { hasPin, useUnlock } from '../device';
import { useMe } from '../state/hooks';
import { color } from '../ui';

export default function Index() {
  const { isActive } = useSpacetimeDB();
  const { me, ready } = useMe();
  const { unlocked } = useUnlock();
  const [pinSet, setPinSet] = useState<boolean | null>(null);

  useEffect(() => {
    hasPin().then(setPinSet);
  }, []);

  if (!isActive || !ready || pinSet === null) {
    return (
      <View style={{ flex: 1, backgroundColor: color.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={color.text} />
      </View>
    );
  }
  if (!me) return <Redirect href={'/join' as never} />;
  if (!pinSet) return <Redirect href={'/pin' as never} />;
  if (!unlocked) return <Redirect href={'/unlock' as never} />;
  return <Redirect href={'/(tabs)/home' as never} />;
}
