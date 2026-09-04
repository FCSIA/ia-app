import { Redirect, Tabs } from "expo-router";
import { StyleSheet } from "react-native";
import { CalendarDays, Compass, Home, Megaphone, UsersRound } from "lucide-react-native";
import { useConvexAuth } from "@/lib/convex-react";
import { useLiveCurrentUser } from "@/lib/auth";
import { usePrewarmTab, type PrewarmTab } from "@/lib/route-prewarm";
import { useTheme } from "@/lib/theme";
import { tapLight } from "@/lib/haptics";

export default function TabsLayout() {
  const auth = useConvexAuth();
  const user = useLiveCurrentUser();
  const { color } = useTheme();
  const prewarm = usePrewarmTab(user);

  /**
   * `tabPress` fires before the destination screen commits, so starting that
   * tab's queries here gives them a head start on the mount rather than holding
   * every tab's data open for the whole session.
   */
  const onTabPress = (tab: PrewarmTab) => () => {
    void tapLight();
    prewarm(tab);
  };

  if (!auth.isLoading && !auth.isAuthenticated) return <Redirect href="/login" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: color("primary"),
        tabBarInactiveTintColor: color("mutedForeground"),
        tabBarLabelStyle: {
          fontWeight: "600"
        },
        tabBarHideOnKeyboard: true,
        sceneStyle: {
          backgroundColor: color("background")
        },
        tabBarStyle: {
          backgroundColor: color("card"),
          borderTopColor: color("border"),
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0
        }
      }}
    >
      <Tabs.Screen name="dashboard" listeners={{ tabPress: onTabPress("dashboard") }} options={{ title: "Home", tabBarIcon: ({ color: c }) => <Home color={c} size={21} /> }} />
      <Tabs.Screen name="calendar" listeners={{ tabPress: onTabPress("calendar") }} options={{ title: "Calendar", tabBarIcon: ({ color: c }) => <CalendarDays color={c} size={21} /> }} />
      <Tabs.Screen name="clubs" listeners={{ tabPress: onTabPress("clubs") }} options={{ title: "Clubs", tabBarIcon: ({ color: c }) => <UsersRound color={c} size={21} /> }} />
      <Tabs.Screen name="announcements" listeners={{ tabPress: onTabPress("announcements") }} options={{ title: "Feed", tabBarIcon: ({ color: c }) => <Megaphone color={c} size={21} /> }} />
      <Tabs.Screen name="discover" listeners={{ tabPress: onTabPress("discover") }} options={{ title: "Discover", tabBarIcon: ({ color: c }) => <Compass color={c} size={21} /> }} />
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
          title: "Inbox"
        }}
      />
    </Tabs>
  );
}
