import { ActivityIndicator, Text, View } from "react-native";
import type React from "react";
import { Empty } from "@/components/ui/empty";
import { useTheme } from "@/lib/theme";

export function DataBoundary<T>({
  data,
  emptyTitle,
  children
}: {
  data: T | undefined | null;
  emptyTitle?: string;
  children: (data: NonNullable<T>) => React.ReactNode;
}) {
  const { color } = useTheme();
  if (data === undefined) {
    return (
      <View style={{ padding: 24, alignItems: "center" }}>
        <ActivityIndicator color={color("primary")} />
      </View>
    );
  }
  if (data === null || (Array.isArray(data) && data.length === 0)) {
    return <Empty title={emptyTitle ?? "Nothing here yet"} />;
  }
  try {
    return <>{children(data as NonNullable<T>)}</>;
  } catch (error) {
    return (
      <Text style={{ color: color("destructive") }}>
        {error instanceof Error ? error.message : "Something went wrong."}
      </Text>
    );
  }
}
