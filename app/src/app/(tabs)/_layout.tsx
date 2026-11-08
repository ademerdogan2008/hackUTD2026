import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { StyleSheet } from 'react-native';
import { ChatUnreadProvider, useChatUnread } from '../../features/chat/unread';
import { GlobalAlarm } from '../../features/incident/GlobalAlarm';
import { JevAlarm } from '../../features/jev/JevAlarm';
import { color, font } from '../../ui';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

const icon = (outline: IconName, filled: IconName) =>
  function TabIcon({ color: c, focused }: { color: unknown; focused: boolean }) {
    return <Ionicons name={focused ? filled : outline} size={22} color={c as string} />;
  };

export default function TabsLayout() {
  return (
    <ChatUnreadProvider>
      <GlobalAlarm />
      <JevAlarm />
      <TabsNav />
    </ChatUnreadProvider>
  );
}

function TabsNav() {
  const { unread } = useChatUnread();
  const badge = unread > 0 ? (unread > 9 ? '9+' : unread) : undefined;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color.text,
        tabBarInactiveTintColor: color.textTertiary,
        tabBarStyle: { backgroundColor: color.bg, borderTopColor: color.hairline, borderTopWidth: StyleSheet.hairlineWidth, elevation: 0, shadowOpacity: 0 },
        tabBarLabelStyle: { fontSize: 12, lineHeight: 14, fontFamily: font.displaySemi, letterSpacing: 1, textTransform: 'uppercase' },
        sceneStyle: { backgroundColor: color.bg },
      }}
    >
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home-outline', 'home') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: icon('checkmark-circle-outline', 'checkmark-circle') }} />
      <Tabs.Screen name="board" options={{ title: 'Board', tabBarIcon: icon('grid-outline', 'grid') }} />
      <Tabs.Screen name="chat" options={{ title: 'Chat', tabBarIcon: icon('chatbubble-outline', 'chatbubble'), tabBarBadge: badge, tabBarBadgeStyle: styles.badge }} />
      <Tabs.Screen name="team" options={{ title: 'Team', tabBarIcon: icon('people-outline', 'people') }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  badge: {
    backgroundColor: color.danger,
    color: color.onDanger,
    fontFamily: font.mono,
    fontSize: 10,
    lineHeight: 16,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    top: -2,
  },
});
