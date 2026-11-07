import '../polyfills';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UnlockProvider } from '../device';
import { SpacetimeRoot } from '../spacetime/SpacetimeRoot';
import { color } from '../ui';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SpacetimeRoot>
        <UnlockProvider>
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: color.bg } }}>
            <Stack.Screen name="unlock" options={{ gestureEnabled: false }} />
          </Stack>
        </UnlockProvider>
      </SpacetimeRoot>
    </SafeAreaProvider>
  );
}
