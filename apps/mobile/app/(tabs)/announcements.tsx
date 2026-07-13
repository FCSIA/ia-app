import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { useQuery } from "convex/react";
import { AppHeader } from "@/components/app-header";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { SegmentedControl } from "@/components/ui";
import { useTheme } from "@/lib/theme";
import { spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

type Filter = "all" | "unread" | "saved";

export default function AnnouncementsScreen() {
  const [filter, setFilter] = useState<Filter>("all");
  const [refreshing, setRefreshing] = useState(false);
  const announcements = useQuery(api.announcements.feed.list, filter === "unread" ? { unreadOnly: true } : {});
  const filtered = filter === "saved" ? announcements?.filter((item: any) => item.isBookmarked) : announcements;
  const { color } = useTheme();
  const emptyTitle =
    filter === "unread"
      ? "You're all caught up"
      : filter === "saved"
        ? "No saved announcements"
        : "No announcements yet";

  return (
    <Screen
      header={<AppHeader title="Feed" />}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          tintColor={color("primary")}
          onRefresh={() => {
            setRefreshing(true);
            setTimeout(() => setRefreshing(false), 550);
          }}
        />
      }
    >
      <SegmentedControl
        value={filter}
        onChange={setFilter}
        segments={[
          { label: "All", value: "all" },
          { label: "Unread", value: "unread" },
          { label: "Saved", value: "saved" },
        ]}
      />
      <DataBoundary data={filtered} emptyTitle={emptyTitle}>
        {(items) => (
          <View style={{ gap: spacing.sm }}>
            {items.map((item: any) => (
              <AnnouncementCard key={item._id} announcement={item} />
            ))}
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
