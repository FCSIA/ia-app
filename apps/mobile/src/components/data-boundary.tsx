import { Text } from "react-native";
import type React from "react";
import { Empty } from "@/components/ui/empty";
import { SkeletonList } from "@/components/ui/skeleton";
import { useTheme } from "@/lib/theme";

export function DataBoundary<T>({
  data,
  emptyTitle,
  skeleton,
  children
}: {
  data: T | undefined | null;
  emptyTitle?: string;
  skeleton?: React.ReactNode;
  children: (data: NonNullable<T>) => React.ReactNode;
}) {
  const { color } = useTheme();
  if (data === undefined) {
    return <>{skeleton ?? <SkeletonList />}</>;
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
