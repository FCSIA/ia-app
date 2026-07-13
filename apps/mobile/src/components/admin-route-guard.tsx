import type { ReactNode } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect } from "expo-router";
import { useConvexAuth } from "convex/react";
import { canAccessAdminWorkspace, useLiveCurrentUser } from "@/lib/auth";
import { useTheme } from "@/lib/theme";

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  const user = useLiveCurrentUser();
  const { color } = useTheme();

  if (auth.isLoading || (auth.isAuthenticated && user === undefined)) {
    return (
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Checking admin access"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: color("background"),
        }}
      >
        <ActivityIndicator color={color("primary")} />
      </View>
    );
  }

  if (!auth.isAuthenticated) return <Redirect href="/login" />;
  if (!canAccessAdminWorkspace(user)) return <Redirect href="/dashboard" />;

  return children;
}
