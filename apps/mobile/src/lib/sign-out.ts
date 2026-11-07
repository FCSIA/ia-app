import { router } from "expo-router";
import { authClient } from "@/lib/auth-client";
import type { ConvexReactClient } from "@/lib/convex-react";
import { clearOfflineCache } from "@/lib/offline-cache";
import { unregisterStoredNativePushToken } from "@/lib/push";

/** Unregister push while the session still exists, end the session, drop cached data, leave. */
export async function signOut(convex: ConvexReactClient) {
  await unregisterStoredNativePushToken(convex).catch(() => {});
  await authClient.signOut();
  await clearOfflineCache();
  router.replace("/login");
}
