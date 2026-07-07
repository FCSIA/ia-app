import "../global.css";

import { useEffect } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/error-boundary";
import { AppLifecycle } from "@/components/app-lifecycle";
import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { ThemeProvider, useTheme } from "@/lib/theme";

LogBox.ignoreLogs(["[RNScreens] SplitView is supported only for iOS"]);

function RootNavigator() {
  const { color, name } = useTheme();
  const backgroundColor = color("background");
  const foregroundColor = color("foreground");
  const barStyle = name === "light" || name === "bubblegum" ? "dark-content" : "light-content";

  return (
    <>
      <StatusBar barStyle={barStyle} backgroundColor={backgroundColor} translucent={false} />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor },
          headerTintColor: foregroundColor,
          headerShadowVisible: false,
          contentStyle: { backgroundColor }
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)/login" options={{ headerShown: false }} />
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
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

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
