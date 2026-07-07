import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { useQuery } from "convex/react";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { useTheme } from "@/lib/theme";
import { api } from "~/apps/convex/src/_generated/api";

export default function AnnouncementsScreen() {
  const [filter, setFilter] = useState<"all" | "unread" | "saved">("all");
  const announcements = useQuery(api.announcements.feed.list, filter === "unread" ? { unreadOnly: true } : {});
  const filtered = filter === "saved" ? announcements?.filter((item: any) => item.isBookmarked) : announcements;
  const { color } = useTheme();

  return (
    <Screen title="Announcements" subtitle="School, pathway, grade, and club updates.">
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["all", "unread", "saved"] as const).map((item) => {
          const selected = filter === item;
          return (
            <Pressable
              key={item}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item)}
              style={{
                borderRadius: 999,
                paddingHorizontal: 14,
                paddingVertical: 9,
                backgroundColor: selected ? color("foreground") : color("secondary")
              }}
            >
              <Text style={{ color: selected ? color("background") : color("foreground"), fontWeight: "800" }}>
                {item[0].toUpperCase() + item.slice(1)}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <DataBoundary data={filtered} emptyTitle="No announcements">
        {(items) => (
          <FlashList
            data={items}
            scrollEnabled={false}
            ItemSeparatorComponent={() => null}
            renderItem={({ item }) => <AnnouncementCard announcement={item} />}
          />
        )}
      </DataBoundary>
    </Screen>
  );
}
