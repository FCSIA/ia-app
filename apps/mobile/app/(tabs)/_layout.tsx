import { Tabs } from 'expo-router';
import { Home, Megaphone, BookOpen, Calendar, Zap } from 'lucide-react-native';

const TAB_ICON_SIZE = 22;
const ACTIVE = '#2563eb';
const INACTIVE = '#9ca3af';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          borderTopColor: '#e5e7eb',
          backgroundColor: '#fff',
          paddingBottom: 4,
          height: 60,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: '#fff' },
        headerTintColor: '#111827',
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', fontSize: 18 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color }) => <Home size={TAB_ICON_SIZE} color={color} />,
          headerTitle: 'IA School',
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Announcements',
          tabBarLabel: 'News',
          tabBarIcon: ({ color }) => <Megaphone size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          title: 'My Clubs',
          tabBarLabel: 'Clubs',
          tabBarIcon: ({ color }) => <BookOpen size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color }) => <Calendar size={TAB_ICON_SIZE} color={color} />,
        }}
      />
      <Tabs.Screen
        name="flex"
        options={{
          title: 'Flex Friday',
          tabBarLabel: 'Flex',
          tabBarIcon: ({ color }) => <Zap size={TAB_ICON_SIZE} color={color} />,
        }}
      />
    </Tabs>
  );
}
