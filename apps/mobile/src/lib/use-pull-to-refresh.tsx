import { useState } from "react";
import { RefreshControl } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * Convex queries are live, so there is nothing to refetch; the spinner only
 * gives pull-to-refresh the feedback people expect.
 */
export function usePullToRefresh() {
  const { color } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  return (
    <RefreshControl
      refreshing={refreshing}
      tintColor={color("primary")}
      onRefresh={() => {
        setRefreshing(true);
        setTimeout(() => setRefreshing(false), 550);
      }}
    />
  );
}
