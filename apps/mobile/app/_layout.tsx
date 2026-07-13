import "../global.css";

import { useEffect } from "react";
import { ConvexBetterAuthProvider } from "@convex-dev/better-auth/react";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AppErrorBoundary } from "@/components/error-boundary";
import { AppLifecycle } from "@/components/app-lifecycle";
import { authClient } from "@/lib/auth-client";
import { convex } from "@/lib/convex";
import { ThemeProvider, useTheme } from "@/lib/theme";
import { ToastProvider } from "@/components/ui";

LogBox.ignoreLogs(["[RNScreens] SplitView is supported only for iOS"]);

function RootNavigator() {
  const { color } = useTheme();
  const backgroundColor = color("background");
  const foregroundColor = color("foreground");
  const backgroundLightness =
    Number.parseFloat(backgroundColor.match(/([\d.]+)%\)$/)?.[1] ?? "0") / 100;
  const barStyle =
    backgroundLightness > 0.55 ? "dark-content" : "light-content";

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
            <ThemeProvider>
              <BottomSheetModalProvider>
                <ToastProvider>
                  <AppErrorBoundary>
                    <AppLifecycle />
                    <RootNavigator />
                  </AppErrorBoundary>
                </ToastProvider>
              </BottomSheetModalProvider>
            </ThemeProvider>
          </ConvexBetterAuthProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
