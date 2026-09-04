import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import type { ConvexReactClient } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import {
  isChannelNotificationCovered,
  isInboxNotificationCovered,
} from "./push-notification-metadata";

const TOKEN_STORAGE_KEY = "ia_expo_push_token";
const EXPO_GO_PUSH_MESSAGE =
  "Native push requires a development build on Expo SDK 53+; Expo Go can still test the rest of the app.";
const PUSH_NOT_CONFIGURED_MESSAGE =
  "Remote push is disabled in this Personal Team development build.";

function isExpoGo() {
  return Constants.appOwnership === "expo";
}

async function loadNotifications() {
  if (isExpoGo()) return null;
  const notifications = await import("expo-notifications");
  notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      // The Convex unread count is the only badge authority. A push payload is
      // per-delivery and cannot safely represent the user's cross-device count.
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
  return notifications;
}

async function ensureAndroidNotificationChannel(
  Notifications: typeof import("expo-notifications"),
) {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("default", {
    name: "School notifications",
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export function nativePushUnavailableReason() {
  if (Constants.expoConfig?.extra?.nativePushEnabled === false) {
    return PUSH_NOT_CONFIGURED_MESSAGE;
  }
  if (isExpoGo()) return EXPO_GO_PUSH_MESSAGE;
  if (!Device.isDevice) return "Physical device required.";
  return null;
}

export async function registerNativePushToken(convex: ConvexReactClient) {
  const unavailableReason = nativePushUnavailableReason();
  if (unavailableReason) return { ok: false, reason: unavailableReason };

  const Notifications = await loadNotifications();
  if (!Notifications) return { ok: false, reason: EXPO_GO_PUSH_MESSAGE };

  // Android 13+ does not show the notification permission prompt (or issue a
  // reliable Expo token) until the app has created a channel.
  await ensureAndroidNotificationChannel(Notifications);

  const existing = await Notifications.getPermissionsAsync();
  const finalStatus =
    existing.status === "granted"
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;

  if (finalStatus !== "granted") {
    return { ok: false, reason: "Permission not granted." };
  }

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ??
    Constants.easConfig?.projectId;
  const response = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  await convex.mutation(api.notifications.pushExpo.registerToken, {
    token: response.data,
    platform: Platform.OS === "ios" ? "ios" : "android",
    deviceId: Constants.sessionId ?? undefined,
    deviceName: Device.deviceName ?? undefined
  });
  await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, response.data);

  return { ok: true, token: response.data };
}

export async function syncNativePushTokenIfGranted(convex: ConvexReactClient) {
  if (nativePushUnavailableReason()) return { ok: false, reason: nativePushUnavailableReason() };
  const Notifications = await loadNotifications();
  if (!Notifications) return { ok: false, reason: EXPO_GO_PUSH_MESSAGE };
  await ensureAndroidNotificationChannel(Notifications);
  const permissions = await Notifications.getPermissionsAsync();
  if (permissions.status !== "granted") return { ok: false, reason: "Permission not granted." };
  return registerNativePushToken(convex);
}

export async function unregisterStoredNativePushToken(convex: ConvexReactClient) {
  const token = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY);
  if (!token) return;
  await convex.mutation(api.notifications.pushExpo.unregisterToken, { token });
  await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY);
}

export async function syncNativeLauncherBadge(count: number) {
  if (isExpoGo()) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.setBadgeCountAsync(Math.max(0, Math.floor(count)));
}

export async function dismissPresentedNotificationsThrough(cutoff: number) {
  if (isExpoGo() || !Number.isFinite(cutoff)) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.allSettled(
    presented.flatMap((notification) => {
      // Legacy pushes do not include a delivery boundary. Leave them in the
      // tray instead of accidentally dismissing a newer alert.
      return isInboxNotificationCovered(
        notification.request.content.data,
        cutoff,
      )
        ? [Notifications.dismissNotificationAsync(notification.request.identifier)]
        : [];
    }),
  );
}

export async function dismissPresentedChannelNotificationsThrough({
  channelId,
  throughCreatedAt,
}: {
  channelId: string;
  throughCreatedAt: number;
}) {
  if (isExpoGo() || !Number.isFinite(throughCreatedAt)) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  const presented = await Notifications.getPresentedNotificationsAsync();
  await Promise.allSettled(
    presented.flatMap((notification) =>
      isChannelNotificationCovered(
        notification.request.content.data,
        channelId,
        throughCreatedAt,
      )
        ? [Notifications.dismissNotificationAsync(notification.request.identifier)]
        : [],
    ),
  );
}

export async function clearLastNativeNotificationResponse() {
  if (isExpoGo()) return;
  const Notifications = await loadNotifications();
  if (!Notifications) return;
  await Notifications.clearLastNotificationResponseAsync();
}

type NotificationResponseRouter = (href: string) => void;

export function installNotificationResponseRouting(
  onRoute: NotificationResponseRouter,
) {
  if (isExpoGo()) return () => {};
  let active = true;
  let remove = () => {};
  const handled = new Set<string>();
  void loadNotifications().then((Notifications) => {
    if (!Notifications || !active) return;
    const handleResponse = (response: import("expo-notifications").NotificationResponse) => {
      const identifier = response.notification.request.identifier;
      if (handled.has(identifier)) return;
      handled.add(identifier);
      const href = response.notification.request.content.data?.href;
      onRoute(typeof href === "string" ? href : "/notifications");
    };

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (active && response) handleResponse(response);
    }).catch(() => {});
    const subscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    remove = () => subscription.remove();
  });
  return () => {
    active = false;
    remove();
  };
}
