import '../polyfills';
import { Stack } from 'expo-router';
import { SpacetimeRoot } from '../spacetime/SpacetimeRoot';

export default function RootLayout() {
  return (
    <SpacetimeRoot>
      <Stack screenOptions={{ title: 'Red Phone' }} />
    </SpacetimeRoot>
  );
}
