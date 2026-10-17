'use client';

import Link from 'next/link';
import { useMutation, useQuery } from '@/lib/convex-react';
import { ArrowRight } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { AnnouncementWidgetCard } from '@/components/announcements/announcement-card';
import { Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { CardGroup } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader } from '@/components/ui/empty';
import { useToast } from '@/hooks/use-toast';
import { useAnnouncementFeedClock } from '@/components/announcements/use-announcement-feed-clock';

export function AnnouncementsWidget() {
  const now = useAnnouncementFeedClock();
  const { toast } = useToast();
  const announcementsData =
    useQuery(api.announcements.feed.list, { unreadOnly: true, now }) ?? [];
  const pinnedAnnouncements = useQuery(api.announcements.feed.listPinned, { limit: 20, now }) ?? [];
  const bookmarkAnnouncement = useMutation(api.announcements.engagement.bookmark);
  const unbookmarkAnnouncement = useMutation(api.announcements.engagement.unbookmark);
  const pinnedIds = new Set(pinnedAnnouncements.map((announcement) => announcement._id));
  const unreadAnnouncements = [...pinnedAnnouncements.filter((announcement) => !announcement.isRead), ...announcementsData.filter((announcement) => !pinnedIds.has(announcement._id))]
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      if (left.isPromoted !== right.isPromoted) return left.isPromoted ? -1 : 1;
      return right.createdAt - left.createdAt;
    })
    .slice(0, 5);

  return (
    <Panel
      title="Unread Announcements"
      action={
        <Button asChild size="icon-sm" variant="ghost">
          <Link href="/announcements" aria-label="Open announcement feed"><ArrowRight /></Link>
        </Button>
      }
      contentClassName="px-3 pb-3 pt-0 sm:px-4 sm:pb-4"
    >
      {unreadAnnouncements.length > 0 ? (
        <div>
          <CardGroup separated aria-label="Unread announcements">
            {unreadAnnouncements.map((announcement) => (
              <AnnouncementWidgetCard
                key={announcement._id}
                announcement={announcement}
                onBookmarkToggle={(entry) => {
                  const toggle = entry.isBookmarked ? unbookmarkAnnouncement : bookmarkAnnouncement;
                  void toggle({ announcementId: entry._id as Id<'announcements'> })
                    .catch(() => toast({ title: 'Could not update saved announcement', variant: 'destructive' }));
                }}
              />
            ))}
          </CardGroup>
          {announcementsData.length > unreadAnnouncements.length ? (
            <p className="px-1 pt-2 text-xs text-muted-foreground">
              Showing {unreadAnnouncements.length} of {announcementsData.length} unread.
            </p>
          ) : null}
        </div>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyDescription>No unread announcements.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </Panel>
  );
}
