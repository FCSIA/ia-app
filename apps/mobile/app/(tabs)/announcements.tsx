import { useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { Search, X } from "lucide-react-native";
import { useQuery } from "@/lib/convex-react";
import { AppHeader } from "@/components/app-header";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { Empty, IconButton, SegmentedControl, TextField } from "@/components/ui";
import {
  filterAnnouncements,
  type AnnouncementFilter,
} from "@/features/announcements/model";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { api } from "~/apps/convex/src/_generated/api";

export default function AnnouncementsScreen() {
  const [filter, setFilter] = useState<AnnouncementFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const announcements = useQuery(api.announcements.feed.list, {});
  const filtered = useMemo(
    () => filterAnnouncements(announcements ?? [], filter, searchQuery),
    [announcements, filter, searchQuery],
  );
  const { color } = useTheme();
  const filterEmptyTitle =
    filter === "unread"
      ? "You're all caught up"
      : filter === "saved"
        ? "No saved announcements"
        : "No announcements yet";
  const hasSearch = searchQuery.trim().length > 0;

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
      <View
        style={{
          minHeight: 48,
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingLeft: spacing.md,
          paddingRight: hasSearch ? spacing.xs : spacing.md,
          borderRadius: radii.lg,
          backgroundColor: color("secondary"),
        }}
      >
        <Search size={19} color={color("mutedForeground")} />
        <TextField
          accessibilityLabel="Search announcements"
          autoCapitalize="none"
          autoCorrect={false}
          clearButtonMode="never"
          placeholder="Search announcements"
          returnKeyType="search"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={{
            flex: 1,
            minHeight: 48,
            borderWidth: 0,
            backgroundColor: "transparent",
            paddingHorizontal: 0,
          }}
        />
        {hasSearch ? (
          <IconButton
            icon={X}
            label="Clear announcement search"
            variant="ghost"
            size="sm"
            onPress={() => setSearchQuery("")}
          />
        ) : null}
      </View>

      <SegmentedControl
        value={filter}
        onChange={setFilter}
        segments={[
          { label: "All", value: "all" },
          { label: "Unread", value: "unread" },
          { label: "Saved", value: "saved" },
        ]}
      />
      <DataBoundary data={announcements} emptyTitle={filterEmptyTitle}>
        {() =>
          filtered.length ? (
            <View style={{ gap: spacing.xs }}>
              {filtered.map((item: any) => (
                <AnnouncementCard key={item._id} announcement={item} />
              ))}
            </View>
          ) : (
            <Empty
              icon={hasSearch ? Search : undefined}
              title={hasSearch ? "No announcements found" : filterEmptyTitle}
              body={hasSearch ? "Try another search or filter." : undefined}
            />
          )
        }
      </DataBoundary>
    </Screen>
  );
}
