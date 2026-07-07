import { FlashList } from "@shopify/flash-list";
import { useQuery } from "convex/react";
import { AnnouncementCard } from "@/components/announcement-card";
import { DataBoundary } from "@/components/data-boundary";
import { Screen } from "@/components/screen";
import { api } from "~/apps/convex/src/_generated/api";

export default function AnnouncementsScreen() {
  const announcements = useQuery(api.announcements.feed.list, {});
  return (
    <Screen title="Announcements" subtitle="School, pathway, grade, and club updates.">
      <DataBoundary data={announcements} emptyTitle="No announcements">
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
