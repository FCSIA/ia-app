import type { ReactNode } from 'react';
import { Tabs } from 'expo-router';
import {
  BookOpen,
  CalendarDays,
  LayoutDashboard,
  Megaphone,
  Zap,
} from 'lucide-react-native';
import { theme } from '@/theme';

function TabIcon({
  focused,
  color,
  children,
}: {
  focused: boolean;
  color: string;
  children: ReactNode;
}) {
  return (
    <>{children}</>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.colors.accent,
        tabBarInactiveTintColor: theme.colors.textFaint,
        tabBarStyle: {
          height: 74,
          paddingTop: 8,
          paddingBottom: 12,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          backgroundColor: 'rgba(255,255,255,0.96)',
          position: 'absolute',
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '700',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <LayoutDashboard size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="announcements"
        options={{
          title: 'Announcements',
          tabBarLabel: 'News',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <Megaphone size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="clubs"
        options={{
          title: 'Clubs',
          tabBarLabel: 'Clubs',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <BookOpen size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          tabBarLabel: 'Calendar',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <CalendarDays size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
      <Tabs.Screen
        name="flex"
        options={{
          title: 'Flex Friday',
          tabBarLabel: 'Flex',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused}>
              <Zap size={20} color={color} />
            </TabIcon>
          ),
        }}
      />
    </Tabs>
  );
}
