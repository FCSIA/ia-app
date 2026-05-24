'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { NotificationSettingsPanel } from '@/components/notifications/notification-settings-panel';
import { cn } from '@/lib/utils';

const CATEGORY_LABEL: Record<string, string> = {
  SCHOOL_ANNOUNCEMENT: 'School',
  CLUB_ANNOUNCEMENT: 'Club',
  CLUB_JOIN_REQUEST: 'Club',
  CLUB_CHANNEL_MESSAGE: 'Channel',
  CLUB_CHANNEL_MENTION: 'Mention',
  CLUB_CHANNEL_TAG_MENTION: 'Tag mention',
  CLUB_CHANNEL_THREAD: 'Thread',
  EVENT: 'Event',
  FLEX_FRIDAY: 'Flex Friday',
  CONTENT_MODERATED: 'Moderation',
  FRIEND_REQUEST: 'Friends',
};

export default function NotificationsPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll().then((r) => r.data),
  });

  const filteredNotifications = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return notifications;
    return (notifications as any[]).filter((n) => {
      const searchable = [n.title, n.body, n.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [notifications, deferredSearch]);

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
      toast({ title: 'All marked as read' });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead([id]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications'] });
      qc.invalidateQueries({ queryKey: ['unread-count'] });
    },
  });

  function getNotificationHref(notification: any) {
    if (notification.channelId && notification.clubId) {
      return `/clubs/${notification.clubId}/channels/${notification.channelId}`;
    }
    if (notification.announcementId) return `/announcements/${notification.announcementId}`;
    if (notification.eventId) return '/events';
    if (notification.category === 'FRIEND_REQUEST') {
      return '/schedule?tab=friends&section=requests';
    }
    if (notification.category === 'CONTENT_MODERATED') return '/profile';
    if (notification.category === 'FLEX_FRIDAY') return '/flex-friday';
    if (notification.clubId) return `/clubs/${notification.clubId}`;
    return null;
  }

  function openNotification(notification: any) {
    const href = getNotificationHref(notification);
    if (!notification.isRead) markReadMutation.mutate(notification.id);
    if (href) router.push(href);
  }

  const hasUnread = (notifications as any[]).some((n: any) => !n.isRead);

  return (
    <AppShell>
      <PageFrame className="pt-0">
        <div className="mx-auto w-full max-w-2xl space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Notifications
              </h1>
              <p className="text-sm text-muted-foreground">
                Everything that needs your attention, in one place.
              </p>
            </div>
            {hasUnread && (
              <Button
                variant="tertiary"
                size="sm"
                onClick={() => markAllMutation.mutate()}
                disabled={markAllMutation.isPending}
                className="rounded-full"
              >
                <CheckCheck className="size-4" />
                Mark all read
              </Button>
            )}
          </div>

          <Tabs defaultValue="inbox" className="w-full">
            <TabsList>
              <TabItem value="inbox" icon={Bell} label="Inbox" />
              <TabItem value="settings" icon={Settings} label="Settings" />
            </TabsList>
            <TabPanel value="inbox" className="mt-4">
              <SearchInput
                value={search}
                onValueChange={setSearch}
                placeholder="Search notifications..."
              />

          {isLoading ? (
            <div className="rounded-3xl border bg-card px-6 py-16 text-center text-sm text-muted-foreground">
              Loading…
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border/70 bg-muted/20 px-6 py-16 text-center">
              <Bell className="mx-auto mb-3 size-8 text-muted-foreground/60" />
              <p className="text-sm font-medium text-foreground">
                {search.trim() ? 'No results found' : 'You’re all caught up'}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search.trim()
                  ? 'Try a different search term.'
                  : 'New notifications will appear here.'}
              </p>
              {search.trim() && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSearch('')}
                  className="mt-3 rounded-full"
                >
                  Clear search
                </Button>
              )}
            </div>
          ) : (
            <Panel contentClassName="p-0">
              <ul className="divide-y divide-border">
                {filteredNotifications.map((n: any) => {
                  const href = getNotificationHref(n);
                  const isClickable = !!href;
                  const categoryLabel =
                    CATEGORY_LABEL[n.category] ?? n.category?.replace(/_/g, ' ') ?? 'Update';
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        onClick={() => openNotification(n)}
                        disabled={!isClickable && n.isRead}
                        className={cn(
                          'flex w-full items-start gap-4 px-6 py-4 text-left transition-colors',
                          isClickable
                            ? 'hover:bg-muted/40'
                            : 'cursor-default',
                          !n.isRead ? 'bg-primary/[0.04]' : '',
                        )}
                      >
                        <span
                          className={cn(
                            'mt-2 size-2 shrink-0 rounded-full',
                            n.isRead ? 'bg-muted-foreground/30' : 'bg-primary',
                          )}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="solid" className="rounded-full text-[10px]">
                              {categoryLabel}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground">
                              {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                            </span>
                          </div>
                          <p
                            className={cn(
                              'text-sm font-medium',
                              n.isRead ? 'text-muted-foreground' : 'text-foreground',
                            )}
                          >
                            {n.title}
                          </p>
                          {n.body && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                          )}
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          )}
            </TabPanel>
            <TabPanel value="settings" className="mt-4">
              <NotificationSettingsPanel />
            </TabPanel>
          </Tabs>
        </div>
      </PageFrame>
    </AppShell>
  );
}
