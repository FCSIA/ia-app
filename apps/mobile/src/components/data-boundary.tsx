import { useState, type ReactNode } from "react";
import { View } from "react-native";
import { pickNavigationLoadingFact } from "@ia/fun-facts";
import { Empty } from "@/components/ui/empty";
import { IaLoadingMark } from "@/components/ui/ia-loading-mark";
import { LoadingFact } from "@/components/ui/loading-fact";

export function DataBoundary<T>({
  data,
  emptyTitle,
  skeleton,
  children
}: {
  data: T | undefined | null;
  emptyTitle?: string;
  skeleton?: ReactNode;
  children: (data: NonNullable<T>) => ReactNode;
}) {
  const [fact] = useState(pickNavigationLoadingFact);

  if (data === undefined) {
    return (
      <>
        {skeleton ?? (
          <View style={{ minHeight: 240, paddingVertical: 64, alignItems: "center", justifyContent: "center", width: "100%", gap: 20 }}>
            <IaLoadingMark size="md" />
            <LoadingFact fact={fact} />
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
