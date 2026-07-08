import { useState } from "react";
import { RefreshControl, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
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

  return (
    <Screen
      header={<AppHeader title="Feed" subtitle="School, pathway, grade, and club updates." />}
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
      <DataBoundary data={filtered} emptyTitle="No announcements">
        {(items) => (
          <View style={{ minHeight: Math.max(1, items.length) * 190 }}>
            <FlashList
              data={items}
              scrollEnabled={false}
              ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
              renderItem={({ item }) => <AnnouncementCard announcement={item} />}
            />
          </View>
        )}
      </DataBoundary>
    </Screen>
  );
}
