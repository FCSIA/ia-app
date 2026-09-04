'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useMutation, useQuery } from '@/lib/convex-react';
import { ArrowRight, Bookmark, BookmarkCheck, MessageCircle, Pin } from 'lucide-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import {
  ANNOUNCEMENT_TAG_BADGE_COLORS,
  ANNOUNCEMENT_TAG_LABELS,
} from '@/components/announcements/announcement-card';
import { Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardFooter, CardGroup, CardHeader, CardTitle } from '@/components/ui/card';
import { Tooltip } from '@/components/ui/tooltip';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';

export function AnnouncementsWidget() {
  const announcementsData =
    useQuery(api.announcements.feed.list, { unreadOnly: true }) ?? [];
  const bookmarkAnnouncement = useMutation(api.announcements.engagement.bookmark);
  const unbookmarkAnnouncement = useMutation(api.announcements.engagement.unbookmark);
  const unreadAnnouncements = announcementsData.slice(0, 5);

  return (
    <Panel
      title="Announcements"
      action={
        <Button asChild size="sm" variant="ghost">
          <Link href="/announcements">
            Open feed
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      }
      contentClassName="px-3 pb-3 pt-3 sm:px-4 sm:pb-4"
    >
      {unreadAnnouncements.length > 0 ? (
        <div>
          <CardGroup orientation="inline" aria-label="Unread announcements">
          {unreadAnnouncements.map((announcement) => (
            <Card
              key={announcement._id}
              href={`/announcements/${announcement._id}`}
              label={`Open announcement: ${announcement.title}`}
              className="border-l-2 border-l-primary"
            >
              <CardHeader>
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <Badge size="sm" color="blue">Unread</Badge>
                  {announcement.isPinned ? (
                    <Badge size="sm" variant="solid" color="amber">
                      <Pin />
                      Pinned
                    </Badge>
                  ) : null}
                  <Badge size="sm" color={ANNOUNCEMENT_TAG_BADGE_COLORS[announcement.targetType] ?? 'gray'}>
                    {ANNOUNCEMENT_TAG_LABELS[announcement.targetType] ?? announcement.targetType.replace(/_/g, ' ')}
                  </Badge>
                  {announcement.club?.name ? (
                    <Badge size="sm" variant="solid" color="emerald">
                      {announcement.club.name}
                    </Badge>
                  ) : null}
                </div>
                <CardTitle>{announcement.title}</CardTitle>
                <CardDescription>
                  {[announcement.author?.firstName, announcement.author?.lastName].filter(Boolean).join(' ') || 'School'} ·{' '}
                  {formatDistanceToNow(new Date(announcement.createdAt), { addSuffix: true })}
                </CardDescription>
              </CardHeader>
              <CardFooter className="opacity-100 transition-opacity md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100">
                {announcement.allowComments ? (
                  <Tooltip content="Open comments">
                    <Button asChild size="icon-sm" variant="ghost" aria-label="Open comments">
                      <Link href={`/announcements/${announcement._id}#comments`}>
                        <MessageCircle />
                      </Link>
                    </Button>
                  </Tooltip>
                ) : null}
                <Tooltip content={announcement.isBookmarked ? 'Remove bookmark' : 'Bookmark'}>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={announcement.isBookmarked ? 'Remove bookmark' : 'Bookmark'}
                    onClick={() => {
                      const toggle = announcement.isBookmarked ? unbookmarkAnnouncement : bookmarkAnnouncement;
                      void toggle({ announcementId: announcement._id as Id<'announcements'> }).catch(() => undefined);
                    }}
                  >
                    {announcement.isBookmarked ? <BookmarkCheck /> : <Bookmark />}
                  </Button>
                </Tooltip>
                <Tooltip content="Mark read">
                  <AnnouncementReadToggle
                    announcementId={announcement._id}
                    isRead={announcement.isRead}
                    iconOnly
                    variant="ghost"
                  />
                </Tooltip>
              </CardFooter>
            </Card>
          ))}
          </CardGroup>
          {announcementsData.length > unreadAnnouncements.length ? (
            <p className="px-1 pt-2 text-xs text-muted-foreground">
              Showing {unreadAnnouncements.length} of {announcementsData.length} unread.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm text-muted-foreground">
          No unread announcements.
        </div>
      )}
    </Panel>
  );
}
