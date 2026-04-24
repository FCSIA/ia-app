'use client';

import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, Megaphone } from 'lucide-react';
import { Panel } from '@/components/layout/page-frame';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';
import { announcementsApi } from '@/lib/api';

export function AnnouncementsWidget() {
  const { data: announcementsData = [] } = useQuery({
    queryKey: ['announcements', 'dashboard', 'unread'],
    queryFn: () => announcementsApi.getAll(false, undefined, true).then((response) => response.data),
  });

  const unreadAnnouncements = (announcementsData as any[]).slice(0, 3);

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
          {unreadAnnouncements.map((announcement: any) => (
            <div
              key={announcement.id}
              className="rounded-[1.4rem] border border-border/70 bg-background/85 px-4 py-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/10">Unread</Badge>
                    {announcement.club?.name ? (
                      <Badge variant="outline">{announcement.club.name}</Badge>
                    ) : null}
                  </div>
                  <Link href={`/announcements/${announcement.id}`}>
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
                  announcementId={announcement.id}
                  isRead={announcement.isRead}
                />
              </div>
            </div>
          ))}
          {(announcementsData as any[]).length > unreadAnnouncements.length ? (
            <p className="px-1 text-xs text-muted-foreground">
              Showing {unreadAnnouncements.length} of {(announcementsData as any[]).length} unread.
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
