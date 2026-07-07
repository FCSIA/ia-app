import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import type { ConvexReactClient } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";
import { openAppHref } from "./deep-links";

const TOKEN_STORAGE_KEY = "ia_expo_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: false,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true
  })
});

export async function registerNativePushToken(convex: ConvexReactClient) {
  if (!Device.isDevice) return { ok: false, reason: "Physical device required." };

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
  const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
    const href = response.notification.request.content.data?.href;
    openAppHref(typeof href === "string" ? href : "/notifications");
  });
  return () => subscription.remove();
}
