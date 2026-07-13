import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import type { ConvexReactClient } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import { openAppHref } from "./deep-links";

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
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true
    })
  });
  return notifications;
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

export function installNotificationResponseRouting() {
  if (isExpoGo()) return () => {};
  let remove = () => {};
  void loadNotifications().then((Notifications) => {
    if (!Notifications) return;
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const href = response.notification.request.content.data?.href;
      openAppHref(typeof href === "string" ? href : "/notifications");
    });
    remove = () => subscription.remove();
  });
  return () => remove();
}
