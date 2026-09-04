import { useEffect, useRef, useState } from "react";
import Constants from "expo-constants";
import { AppState } from "react-native";
import * as ScreenCapture from "expo-screen-capture";
import { useConvex, useConvexAuth, useQuery } from "convex/react";
import { openAppHref } from "@/lib/deep-links";
import {
  clearLastNativeNotificationResponse,
  installNotificationResponseRouting,
  syncNativeLauncherBadge,
  syncNativePushTokenIfGranted,
} from "@/lib/push";
import { api } from "~/apps/convex/src/_generated/api";

export function AppLifecycle() {
  const convex = useConvex();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const unread = useQuery(
    api.notifications.inbox.unreadCount,
    isAuthenticated ? {} : "skip",
  );
  const [pendingNotificationHref, setPendingNotificationHref] = useState<
    string | null
  >(null);
  const appState = useRef(AppState.currentState);
  const [isActive, setIsActive] = useState(appState.current === "active");

  useEffect(
    () =>
      installNotificationResponseRouting((href) => {
        setPendingNotificationHref(href);
      }),
    [],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      appState.current = nextState;
      setIsActive(nextState === "active");
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pendingNotificationHref || isLoading || !isAuthenticated) return;
    openAppHref(pendingNotificationHref);
    setPendingNotificationHref(null);
    void clearLastNativeNotificationResponse().catch(() => {});
  }, [isAuthenticated, isLoading, pendingNotificationHref]);

  useEffect(() => {
    if (!isActive) return;
    const count = isAuthenticated ? unread?.count : 0;
    if (count === undefined) return;
    void syncNativeLauncherBadge(count).catch(() => {});
  }, [isActive, isAuthenticated, unread?.count]);

  useEffect(() => {
    if (Constants.appOwnership === "expo" || __DEV__) return;
    ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    return () => {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncNativePushTokenIfGranted(convex).catch(() => {
      // Permission prompts happen from the Notifications screen, not silently here.
    });
  }, [convex, isAuthenticated]);

  return null;
}
