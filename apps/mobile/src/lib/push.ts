import { Platform } from "react-native";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import type { ConvexReactClient } from "convex/react";
import { api } from "~/apps/convex/src/_generated/api";

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

  return { ok: true, token: response.data };
}
