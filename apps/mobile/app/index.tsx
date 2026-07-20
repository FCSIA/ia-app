import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useConvexAuth } from "convex/react";
import { useTheme } from "@/lib/theme";
import { ScreenLoader } from "@/components/ui";

export default function Index() {
  const auth = useConvexAuth();
  const { color } = useTheme();

  if (auth.isLoading) {
    return <ScreenLoader />;
  }

  return <Redirect href={auth.isAuthenticated ? "/dashboard" : "/login"} />;
}
