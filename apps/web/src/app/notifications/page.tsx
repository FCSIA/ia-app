'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter } from 'next/navigation';
import { useMutation, usePaginatedQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Bell, BellDot, CheckCheck, Inbox, SearchX, Settings } from 'lucide-react';
import { PageFrame } from '@/components/layout/page-frame';
import { Button } from '@/components/ui/button';
import { Badge, type BadgeColor } from '@/components/ui/badge';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { SearchInput } from '@/components/ui/search';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { NotificationSettingsPanel } from '@/components/notifications/notification-settings-panel';
import { NOTIFICATION_CATEGORY_DETAILS } from '@/components/notifications/notification-category-options';
import { cn } from '@/lib/utils';
import type { NotificationCategory } from '~/apps/convex/src/validators';

const CATEGORY_COLORS: Record<NotificationCategory, BadgeColor> = {
  SCHOOL_ANNOUNCEMENT: 'blue',
  CLUB_ANNOUNCEMENT: 'orange',
  CLUB_JOIN_REQUEST: 'amber',
  CLUB_CHANNEL_MESSAGE: 'teal',
  CLUB_CHANNEL_MENTION: 'violet',
  CLUB_CHANNEL_TAG_MENTION: 'purple',
  CLUB_CHANNEL_THREAD: 'indigo',
  EVENT: 'green',
  FLEX_FRIDAY: 'pink',
  CONTENT_MODERATED: 'red',
  FRIEND_REQUEST: 'cyan',
};

function NotificationListSkeleton() {
  return (
    <div>
      {Array.from({ length: 5 }).map((_, index) => (
        <div key={index} className="flex gap-4 border-b border-border/60 py-4 last:border-b-0">
          <Skeleton className="mt-1 size-8 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center gap-2">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="mb-2 h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function NotificationsPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const markAllRead = useMutation(api.notifications.inbox.markAllRead);
  const markRead = useMutation(api.notifications.inbox.markRead);

  const {
    results: notifications,
    status: notificationsStatus,
    loadMore: loadMoreNotifications,
  } = usePaginatedQuery(api.notifications.inbox.listPage, {}, { initialNumItems: 50 });
  const isLoading = notificationsStatus === 'LoadingFirstPage';

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

  const [markingAll, setMarkingAll] = useState(false);

  async function handleMarkAllRead() {
    setMarkingAll(true);
    try {
      await markAllRead();
      toast({ title: 'All marked as read' });
    } finally {
      setMarkingAll(false);
    }
  }

  function handleMarkRead(id: Id<'notificationDeliveries'>) {
    void markRead({ ids: [id] });
  }

  type Notification = typeof notifications[number];

  function openNotification(notification: Notification) {
    if (!notification.isRead) handleMarkRead(notification.id);
    router.push(notification.href);
  }

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const hasUnread = unreadCount > 0;
  const hasQuery = deferredSearch.trim().length > 0;

  return (
    <AppShell>
      <PageFrame className="pt-0">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 flex items-center gap-2">
                <Badge variant="dot" size="sm" color={hasUnread ? 'blue' : 'green'}>
                  {hasUnread ? `${unreadCount} unread` : 'Clear'}
                </Badge>
                <span className="text-xs text-muted-foreground">{notifications.length} total</span>
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Notifications</h1>
            </div>
            <Button
              variant="tertiary"
              size="sm"
              onClick={handleMarkAllRead}
              loading={markingAll}
              disabled={!hasUnread}
              leadingIcon={CheckCheck}
              className="w-full sm:w-fit"
            >
              Mark all read
            </Button>
          </div>

          <Tabs defaultValue="inbox" className="w-full">
            <TabsList className="w-full sm:w-auto">
              <TabItem value="inbox" icon={Bell} label="Inbox" />
              <TabItem value="settings" icon={Settings} label="Settings" />
            </TabsList>
            <TabPanel value="inbox" className="mt-5">
              <div>
                <section className="min-w-0">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchInput
                      value={search}
                      onValueChange={setSearch}
                      placeholder="Search notifications..."
                      className="w-full sm:max-w-md"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {hasQuery
                        ? `${filteredNotifications.length} of ${notifications.length}`
                        : `${notifications.length} notifications`}
                    </span>
                  </div>

                  {isLoading ? (
                    <NotificationListSkeleton />
                  ) : filteredNotifications.length === 0 ? (
                    <Empty className="py-14">
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          {hasQuery ? <SearchX /> : <Inbox />}
                        </EmptyMedia>
                        <EmptyTitle>{hasQuery ? 'No matching notifications' : "You're all caught up"}</EmptyTitle>
                        <EmptyDescription>
                          {hasQuery
                            ? 'Try a different title, message, or category.'
                            : 'New updates will appear here when they need attention.'}
                        </EmptyDescription>
                      </EmptyHeader>
                      {hasQuery ? (
                        <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
                          Clear search
                        </Button>
                      ) : null}
                    </Empty>
                  ) : (
                    <div className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
                      <ul className="divide-y divide-border/60">
                        {filteredNotifications.map((n) => {
                          const categoryDetails = NOTIFICATION_CATEGORY_DETAILS[n.category];
                          const categoryColor = CATEGORY_COLORS[n.category] ?? 'gray';
                          return (
                            <li key={n.id}>
                              <button
                                type="button"
                                onClick={() => openNotification(n)}
                                className={cn(
                                  'group flex w-full items-start gap-3 p-3 text-left transition-colors',
                                  'hover:bg-hover focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]',
                                  !n.isRead && 'bg-surface-4',
                                )}
                              >
                                <span
                                  className={cn(
                                    'mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-full border transition-colors',
                                    n.isRead
                                      ? 'border-border bg-muted/25 text-muted-foreground'
                                      : 'border-primary/20 bg-primary/10 text-primary',
                                  )}
                                  aria-hidden
                                >
                                  {n.isRead ? <Bell className="size-4" /> : <BellDot className="size-4" />}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="mb-1.5 flex flex-wrap items-center gap-2">
                                    <Badge variant="solid" size="sm" color={categoryColor}>
                                      {categoryDetails?.badgeLabel ?? 'Update'}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">
                                      {formatDistanceToNow(new Date(n.createdAt), {
                                        addSuffix: true,
                                      })}
                                    </span>
                                    {!n.isRead ? (
                                      <span className="size-1.5 rounded-full bg-primary" aria-label="Unread" />
                                    ) : null}
                                  </span>
                                  <span
                                    className={cn(
                                      'block text-sm font-medium leading-5',
                                      n.isRead ? 'text-muted-foreground' : 'text-foreground',
                                    )}
                                  >
                                    {n.title}
                                  </span>
                                  {n.body ? (
                                    <span className="mt-1 block line-clamp-2 text-xs leading-5 text-muted-foreground">
                                      {n.body}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {filteredNotifications.length > 0 && notificationsStatus !== 'Exhausted' ? (
                    <div className="mt-4 flex justify-center">
                      <Button
                        variant="tertiary"
                        onClick={() => loadMoreNotifications(50)}
                        loading={notificationsStatus === 'LoadingMore'}
                        disabled={notificationsStatus !== 'CanLoadMore'}
                      >
                        Load more
                      </Button>
                    </div>
                  ) : null}
                </section>

              </div>
            </TabPanel>
            <TabPanel value="settings" className="mt-5 max-w-4xl">
              <NotificationSettingsPanel />
            </TabPanel>
          </Tabs>
        </div>
      </PageFrame>
    </AppShell>
  );
}
