"use client";
import { useQuery } from "@/lib/convex-react";
import { api } from "~/apps/convex/src/_generated/api";
import { AnnouncementWidgetCard } from "@/components/announcements/announcement-card";
import { Panel } from "@/components/layout/page-frame";
import { CardGroup } from "@/components/ui/card";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import { useAnnouncementFeedClock } from "@/components/announcements/use-announcement-feed-clock";

export function AnnouncementsWidget() {
  const now = useAnnouncementFeedClock();
  const data = useQuery(api.announcements.feed.unreadPreview, {
    limit: 5,
    now,
  });
  return (
    <Panel
      title="Unread announcements"
      href="/announcements"
      count={data ? `${data.total}${data.hasMore ? "+" : ""}` : undefined}
      loading={data === undefined}
      loadingRows={5}
      flush
    >
      {data?.items.length ? (
        <CardGroup
          orientation="inline"
          corners="compact"
          aria-label="Unread announcements"
        >
          {data.items.map((announcement) => (
            <AnnouncementWidgetCard
              key={announcement._id}
              announcement={announcement}
            />
          ))}
        </CardGroup>
      ) : (
        <Empty size="inline">
          <EmptyDescription>
            {data?.hasMore
              ? "Open announcements to check the rest of your feed."
              : "No unread announcements."}
          </EmptyDescription>
        </Empty>
      )}
    </Panel>
  );
}
