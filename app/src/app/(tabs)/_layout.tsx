import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { GlobalAlarm } from '../../features/incident/GlobalAlarm';
import { color } from '../../ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color: c, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={22} color={c as string} />;
  };

export default function TabsLayout() {
  return (
    <>
    <GlobalAlarm />
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.textTertiary,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.hairline, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, shadowOpacity: 0 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: icon('checkmark-circle-outline', 'checkmark-circle') }} />
      <Tabs.Screen name="board" options={{ title: 'Board', tabBarIcon: icon('grid-outline', 'grid') }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon('chatbubble-outline', 'chatbubble') }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: icon('people-outline', 'people') }} />
    </Tabs>
    </>
  );
}
