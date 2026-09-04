import "react-native-gesture-handler";
import "../global.css";

import { useEffect } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { ConvexQueryCacheProvider } from "@/components/convex-query-cache-provider";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/error-boundary";
import { AppLifecycle } from "@/components/app-lifecycle";
import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { statusBarStyleForBackground } from "@/lib/status-bar-style";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";
import { useLiveCurrentUser } from "@/lib/auth";

LogBox.ignoreLogs(["[RNScreens] SplitView is supported only for iOS"]);

function RootNavigator() {
  const { color } = useTheme();
  const backgroundColor = color("background");
  const foregroundColor = color("foreground");
  const barStyle = statusBarStyleForBackground(backgroundColor);

  return (
    <>
      <StatusBar
        barStyle={barStyle}
        backgroundColor={backgroundColor}
        translucent={false}
      />
      <Stack
        screenOptions={{
          headerShown: false,
          headerStyle: { backgroundColor },
          headerTintColor: foregroundColor,
          headerShadowVisible: false,
          contentStyle: { backgroundColor },
        }}
      />
    </>
  );
}

function PasswordResetGate() {
  const user = useLiveCurrentUser();
  const router = useRouter();
  const segments = useSegments();
  const onPasswordPage = segments[0] === "change-password";

  useEffect(() => {
    if (!user) return;
    if (user.mustResetPassword && !onPasswordPage) {
      router.replace("/change-password" as never);
    } else if (!user.mustResetPassword && onPasswordPage) {
      router.replace("/dashboard" as never);
    }
  }, [onPasswordPage, router, user]);

  return null;
}

export default function Layout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider
        statusBarTranslucent={false}
        navigationBarTranslucent={false}
      >
        <SafeAreaProvider>
          <ConvexBetterAuthProvider client={convex} authClient={authClient}>
            <ConvexQueryCacheProvider>
              <ThemeProvider>
                <BottomSheetModalProvider>
                  <ToastProvider>
                    <AppErrorBoundary>
                      <AppLifecycle />
                      <PasswordResetGate />
                      <RootNavigator />
                    </AppErrorBoundary>
                  </ToastProvider>
                </BottomSheetModalProvider>
              </ThemeProvider>
            </ConvexQueryCacheProvider>
          </ConvexBetterAuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
