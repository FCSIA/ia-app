import "../global.css";

import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/error-boundary";
import { AppLifecycle } from "@/components/app-lifecycle";
import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { ThemeProvider, useTheme } from "@/lib/theme";

function RootNavigator() {
  const { color } = useTheme();
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: color("background") },
          headerTintColor: color("foreground"),
          headerShadowVisible: false,
          contentStyle: { backgroundColor: color("background") }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="announcements/[id]" options={{ title: "Announcement" }} />
        <Stack.Screen name="clubs/[clubId]" options={{ title: "Club" }} />
        <Stack.Screen name="clubs/[clubId]/channels/[channelId]" options={{ title: "Channel" }} />
        <Stack.Screen name="events" options={{ title: "Events" }} />
        <Stack.Screen name="flex-friday" options={{ title: "Flex Friday" }} />
        <Stack.Screen name="flex-friday/pass" options={{ title: "Flex Pass" }} />
        <Stack.Screen name="profile" options={{ title: "Profile" }} />
        <Stack.Screen name="settings/theme" options={{ title: "Theme" }} />
        <Stack.Screen name="design-system" options={{ title: "Design System" }} />
      </Stack>
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ConvexBetterAuthProvider client={convex} authClient={authClient}>
          <ThemeProvider>
            <AppErrorBoundary>
              <AppLifecycle />
              <RootNavigator />
            </AppErrorBoundary>
          </ThemeProvider>
        </ConvexBetterAuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
