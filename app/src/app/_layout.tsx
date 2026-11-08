import '../polyfills';
import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold } from '@expo-google-fonts/inter';
import { SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { UnlockProvider } from '../device';
import { SpacetimeRoot } from '../spacetime/SpacetimeRoot';
import { color } from '../ui';

export default function RootLayout() {
  // On font error we continue with system fonts rather than blocking the app.
  const [loaded, error] = useFonts({ SpaceGrotesk_600SemiBold, SpaceGrotesk_700Bold, Inter_400Regular, Inter_500Medium, Inter_600SemiBold });
  if (!loaded && !error) return <View style={{ flex: 1, backgroundColor: color.bg }} />;
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
