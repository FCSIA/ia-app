import { Redirect, Tabs } from "expo-router";
import { CalendarDays, Home, Megaphone, MoreHorizontal, Rows3, UsersRound } from "lucide-react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import { useTheme } from "@/lib/theme";

const EMPTY_ARGS = {};

export default function TabsLayout() {
  const auth = useConvexAuth();
  const unread = useQuery(api.notifications.inbox.unreadCount, auth.isAuthenticated ? EMPTY_ARGS : "skip");
  const { color } = useTheme();

  if (!auth.isLoading && !auth.isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color("primary"),
        tabBarInactiveTintColor: color("mutedForeground"),
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800"
        },
        tabBarItemStyle: {
          paddingTop: 6
        },
        tabBarStyle: {
          backgroundColor: color("card"),
          borderTopColor: color("border"),
          height: 74,
          paddingBottom: 10,
          paddingTop: 4
        }
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color: c }) => <Home color={c} size={21} /> }} />
      <Tabs.Screen name="calendar" options={{ title: "Calendar", tabBarIcon: ({ color: c }) => <CalendarDays color={c} size={21} /> }} />
      <Tabs.Screen name="announcements" options={{ title: "Posts", tabBarIcon: ({ color: c }) => <Megaphone color={c} size={21} /> }} />
      <Tabs.Screen name="clubs" options={{ title: "Clubs", tabBarIcon: ({ color: c }) => <UsersRound color={c} size={21} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Classes", tabBarIcon: ({ color: c }) => <Rows3 color={c} size={21} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "Inbox",
          tabBarBadge: unread?.count ? unread.count : undefined,
          tabBarIcon: ({ color: c }) => <Megaphone color={c} size={21} />
        }}
      />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color: c }) => <MoreHorizontal color={c} size={21} /> }} />
    </Tabs>
  );
}
