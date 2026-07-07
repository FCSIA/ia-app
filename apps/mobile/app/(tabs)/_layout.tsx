import { Redirect, Tabs } from "expo-router";
import { Bell, CalendarDays, Home, Megaphone, MoreHorizontal, UsersRound } from "lucide-react-native";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import { useTheme } from "@/lib/theme";

export default function TabsLayout() {
  const auth = useConvexAuth();
  const unread = useQuery(api.notifications.inbox.unreadCount, auth.isAuthenticated ? {} : "skip");
  const { color } = useTheme();

  if (!auth.isLoading && !auth.isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color("primary"),
        tabBarInactiveTintColor: color("mutedForeground"),
        tabBarStyle: {
          backgroundColor: color("card"),
          borderTopColor: color("border")
        }
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: "Home", tabBarIcon: ({ color: c }) => <Home color={c} size={21} /> }} />
      <Tabs.Screen name="announcements" options={{ title: "Posts", tabBarIcon: ({ color: c }) => <Megaphone color={c} size={21} /> }} />
      <Tabs.Screen name="clubs" options={{ title: "Clubs", tabBarIcon: ({ color: c }) => <UsersRound color={c} size={21} /> }} />
      <Tabs.Screen name="schedule" options={{ title: "Schedule", tabBarIcon: ({ color: c }) => <CalendarDays color={c} size={21} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Inbox",
          tabBarBadge: unread?.count ? unread.count : undefined,
          tabBarIcon: ({ color: c }) => <Bell color={c} size={21} />
        }}
      />
      <Tabs.Screen name="more" options={{ title: "More", tabBarIcon: ({ color: c }) => <MoreHorizontal color={c} size={21} /> }} />
    </Tabs>
  );
}
