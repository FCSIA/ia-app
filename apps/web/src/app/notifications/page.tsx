'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter } from 'next/navigation';
import { useMutation as useRestMutation, useQueries, useQuery as useRestQuery } from '@tanstack/react-query';
import { useMutation, usePaginatedQuery, useQuery } from 'convex/react';
import { clubsApi } from '@/lib/api';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCheck, Settings } from 'lucide-react';
import { PageFrame, Panel } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SearchInput } from '@/components/ui/search';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { NotificationScopeSwitch } from '@/components/notifications/notification-scope-switch';
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
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const markAllRead = useMutation(api.notifications.markAllRead);
  const markRead = useMutation(api.notifications.markRead);

  const {
    results: notifications,
    status: notificationsStatus,
    loadMore: loadMoreNotifications,
  } = usePaginatedQuery(api.notifications.listPage, {}, { initialNumItems: 50 });
  const isLoading = notificationsStatus === 'LoadingFirstPage';

  const preferences = useQuery(api.notifications.preferences) ?? [];

  const { data: myClubs } = useRestQuery<any>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((r) => r.data),
  });

  const involvedClubs = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    const seen = new Set<string>();
    return entries.filter((club: any) => {
      if (seen.has(club.id)) return false;
      seen.add(club.id);
      return true;
    });
  }, [myClubs]);

  const channelQueries = useQueries({
    queries: involvedClubs.map((club: any) => ({
      queryKey: ['club-channels', club.id],
      queryFn: () => clubsApi.getChannels(club.id).then((r) => r.data),
      enabled: !!club.id,
    })),
  });

  const channelsByClub = useMemo(() => {
    const next = new Map<string, any[]>();
    involvedClubs.forEach((club: any, index) => {
      next.set(club.id, (channelQueries[index]?.data as any[]) ?? []);
    });
    return next;
  }, [channelQueries, involvedClubs]);

  const filteredNotifications = useMemo(() => {
    const query = deferredSearch.trim().toLowerCase();
    if (!query) return notifications;
    return notifications.filter((n) => {
      const searchable = [n.title, n.body, n.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [notifications, deferredSearch]);

  const markAllMutation = useRestMutation({
    mutationFn: () => markAllRead(),
    onSuccess: () => {
      toast({ title: 'All marked as read' });
    },
  });

  const markReadMutation = useRestMutation({
    mutationFn: (id: string) =>
      markRead({ ids: [id as Id<'notificationDeliveries'>] }),
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

  const hasUnread = notifications.some((n) => !n.isRead);

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
          {filteredNotifications.length > 0 && notificationsStatus !== 'Exhausted' ? (
            <div className="mt-4 flex justify-center">
              <Button
                variant="tertiary"
                onClick={() => loadMoreNotifications(50)}
                disabled={notificationsStatus !== 'CanLoadMore'}
                className="rounded-full"
              >
                {notificationsStatus === 'LoadingMore' ? 'Loading...' : 'Load more'}
              </Button>
            </div>
          ) : null}
            </TabPanel>
            <TabPanel value="settings" className="mt-4">
              <Panel contentClassName="flex flex-col gap-5 p-5">
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold">Global</h2>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {[
                      ['SCHOOL_ANNOUNCEMENT', 'School announcements'],
                      ['EVENT', 'Events'],
                      ['FLEX_FRIDAY', 'Flex Friday'],
                      ['FRIEND_REQUEST', 'Friend schedules'],
                      ['CONTENT_MODERATED', 'Moderation notices'],
                    ].map(([category, label]) => (
                      <NotificationScopeSwitch
                        key={category}
                        category={category}
                        label={label}
                      />
                    ))}
                    <NotificationScopeSwitch
                      category="SCHOOL_ANNOUNCEMENT"
                      label="Push notifications to everyone"
                      scopeKey="admin-push"
                      locked
                    />
                  </div>
                </section>
                <section className="flex flex-col gap-3">
                  <h2 className="text-sm font-semibold">Clubs and channels</h2>
                  {involvedClubs.length > 0 ? (
                    <div className="grid gap-3">
                      {involvedClubs.map((club: any) => {
                        const channels = channelsByClub.get(club.id) ?? [];
                        return (
                        <div key={club.id} className="rounded-lg border p-3">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <p className="font-medium">{club.name}</p>
                            <NotificationScopeSwitch
                              category="CLUB_ANNOUNCEMENT"
                              label="Announcements"
                              clubId={club.id}
                              compact
                            />
                          </div>
                          {channels.length > 0 ? (
                            <div className="grid gap-2">
                              {channels.map((channel: any) => (
                                <div
                                  key={channel.id}
                                  className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-muted/30 px-3 py-2"
                                >
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-medium">#{channel.name}</p>
                                    <p className="truncate text-xs text-muted-foreground">
                                      Channel mentions
                                    </p>
                                  </div>
                                  <NotificationScopeSwitch
                                    category="CLUB_CHANNEL_MENTION"
                                    label={`${channel.name} mentions`}
                                    clubId={club.id}
                                    channelId={channel.id}
                                    compact
                                    className="shrink-0"
                                  />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              No visible channels to configure yet.
                            </p>
                          )}
                        </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Join or sponsor clubs to configure club-specific notifications.
                    </p>
                  )}
                </section>
                <p className="text-xs text-muted-foreground">
                  {preferences.length} saved preference{preferences.length === 1 ? '' : 's'}.
                </p>
              </Panel>
            </TabPanel>
          </Tabs>
        </div>
      </PageFrame>
    </AppShell>
  );
}
