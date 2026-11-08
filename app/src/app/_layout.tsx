import '../polyfills';
import { Barlow_400Regular, Barlow_500Medium, Barlow_600SemiBold } from '@expo-google-fonts/barlow';
import { BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from '@expo-google-fonts/barlow-condensed';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
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
  const [loaded, error] = useFonts({
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
    Barlow_400Regular,
    Barlow_500Medium,
    Barlow_600SemiBold,
    JetBrainsMono_500Medium,
  });
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
