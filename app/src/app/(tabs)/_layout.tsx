import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { color, type } from '../../ui';

const glyph = (g: string) =>
  function TabIcon({ color: c }: { color: unknown }) {
    return <Text style={{ fontSize: 22, color: c as string }}>{g}</Text>;
  };

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.textMuted,
        tabBarStyle: { backgroundColor: color.surface, borderTopColor: color.border, borderTopWidth: 1, minHeight: 64 },
        tabBarLabelStyle: { ...type.label, color: undefined },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: glyph('⌂') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: glyph('✓') }} />
      <Tabs.Screen name="board" options={{ title: 'Board', tabBarIcon: glyph('▦') }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: glyph('✉') }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: glyph('☺') }} />
    </Tabs>
  );
}
