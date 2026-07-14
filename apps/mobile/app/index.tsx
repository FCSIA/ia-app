import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useConvexAuth } from "convex/react";
import { useTheme } from "@/lib/theme";

export default function Index() {
  const auth = useConvexAuth();
  const { color } = useTheme();

  if (auth.isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color("background") }}>
        <ActivityIndicator color={color("primary")} />
      </View>
    );
  }

  return <Redirect href={auth.isAuthenticated ? "/dashboard" : "/login"} />;
}
