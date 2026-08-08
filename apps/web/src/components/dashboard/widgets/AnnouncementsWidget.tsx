'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from 'convex/react';
import { ArrowRight, Megaphone } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';

export function AnnouncementsWidget() {
  const announcementsData =
    useQuery(api.announcements.feed.list, { unreadOnly: true }) ?? [];
  const unreadAnnouncements = announcementsData.slice(0, 3);

  return (
    <Panel
      title="Announcements"
      action={
        <Button asChild variant="ghost" className="rounded-2xl">
          <Link href="/announcements">
            Open feed
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
    >
      {unreadAnnouncements.length > 0 ? (
        <div className="space-y-3">
          {unreadAnnouncements.map((announcement) => (
            <div
              key={announcement._id}
              className="rounded-[1.4rem] border border-border/70 bg-background/85 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Unread</Badge>
                    {announcement.club?.name ? (
                      <Badge variant="solid">{announcement.club.name}</Badge>
                    ) : null}
                  </div>
                  <Link href={`/announcements/${announcement._id}`}>
                    <p className="line-clamp-1 text-sm font-semibold text-foreground hover:text-primary">
                      {announcement.title}
                    </p>
                  </Link>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {announcement.body}
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                  </p>
                </div>
                <Megaphone className="mt-1 size-4 shrink-0 text-primary/70" />
              </div>
              <div className="mt-4 flex justify-end">
                <AnnouncementReadToggle
                  announcementId={announcement._id}
                  isRead={announcement.isRead}
                />
              </div>
            </div>
          ))}
          {announcementsData.length > unreadAnnouncements.length ? (
            <p className="px-1 text-xs text-muted-foreground">
              Showing {unreadAnnouncements.length} of {announcementsData.length} unread.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="rounded-[1.4rem] border border-dashed border-border/70 bg-muted/20 px-5 py-10 text-sm text-muted-foreground">
          No unread announcements.
        </div>
      )}
    </Panel>
  );
}
