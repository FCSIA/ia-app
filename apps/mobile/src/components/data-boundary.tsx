import type React from "react";
import { View } from "react-native";
import { Empty } from "@/components/ui/empty";
import { IaLoadingMark } from "@/components/ui/ia-loading-mark";

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
  if (data === undefined) {
    return (
      <>
        {skeleton ?? (
          <View style={{ minHeight: 240, paddingVertical: 64, alignItems: "center", justifyContent: "center", width: "100%" }}>
            <IaLoadingMark size="md" />
          </View>
        )}
      </>
    );
  }
  if (data === null || (Array.isArray(data) && data.length === 0)) {
    return <Empty title={emptyTitle ?? "Nothing here yet"} />;
  }
  try {
    return <>{children(data as NonNullable<T>)}</>;
  } catch {
    return <Empty title="Couldn’t load this" body="Try again." />;
  }
}
