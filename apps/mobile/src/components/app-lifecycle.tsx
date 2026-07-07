import { useEffect } from "react";
import { useConvex, useConvexAuth } from "convex/react";
import { installNotificationResponseRouting, syncNativePushTokenIfGranted } from "@/lib/push";

export function AppLifecycle() {
  const convex = useConvex();
  const { isAuthenticated } = useConvexAuth();

  useEffect(() => installNotificationResponseRouting(), []);

  useEffect(() => {
    if (!isAuthenticated) return;
    syncNativePushTokenIfGranted(convex).catch(() => {
      // Permission prompts happen from the Notifications screen, not silently here.
    });
  }, [convex, isAuthenticated]);

  return null;
}
