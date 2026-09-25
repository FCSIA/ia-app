'use client';

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter } from 'next/navigation';
import { useMutation, usePaginatedQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { formatDistanceToNow } from 'date-fns';
import { Bell, BellDot, Inbox, SearchX, Settings } from 'lucide-react';
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
import { Elevated } from '@/lib/elevated';
import { dismissAcknowledgedWebNotifications } from '@/lib/push-notifications';
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
  FRIEND_SCHEDULE_CHANGE: 'orange',
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
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('inbox');
  const [documentVisible, setDocumentVisible] = useState(true);
  const deferredSearch = useDeferredValue(search);
  const acknowledgeInbox = useMutation(api.notifications.inbox.acknowledgeInbox);
  const markRead = useMutation(api.notifications.inbox.markRead);
  const acknowledgingKeyRef = useRef<string | null>(null);
  const pendingDismissalRef = useRef<{
    cutoff: number;
    deliveryIds: Set<string>;
  } | null>(null);
  const mountedRef = useRef(true);
  const [acknowledging, setAcknowledging] = useState(false);
  const [dismissalRevision, setDismissalRevision] = useState(0);

  const {
    results: notifications,
    status: notificationsStatus,
    loadMore: loadMoreNotifications,
  } = usePaginatedQuery(api.notifications.inbox.listPage, {}, { initialNumItems: 50 });
  const isLoading = notificationsStatus === 'LoadingFirstPage';

  useEffect(() => {
    const syncVisibility = () => setDocumentVisible(document.visibilityState === 'visible');
    syncVisibility();
    document.addEventListener('visibilitychange', syncVisibility);
    return () => document.removeEventListener('visibilitychange', syncVisibility);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A failed acknowledgement may retry after the user leaves and returns to
  // the Inbox, but never continuously for the same visible snapshot.
  useEffect(() => {
    if (!documentVisible) acknowledgingKeyRef.current = null;
  }, [documentVisible]);

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
  const unreadKey = notifications
    .filter((notification) => !notification.isRead)
    .map((notification) => notification.id)
    .join(',');

  useEffect(() => {
    if (activeTab !== 'inbox' || isLoading || !documentVisible || !unreadKey || acknowledging) return;
    if (acknowledgingKeyRef.current === unreadKey) return;

    acknowledgingKeyRef.current = unreadKey;
    setAcknowledging(true);
    const acknowledgedDeliveryIds = new Set(unreadKey.split(','));
    void acknowledgeInbox({})
      .then(({ cutoff }) => {
        pendingDismissalRef.current = { cutoff, deliveryIds: acknowledgedDeliveryIds };
        if (mountedRef.current) setDismissalRevision((current) => current + 1);
      })
      // Keep this exact snapshot acknowledged after a failure too: retrying a
      // failing mutation on every render would create a request loop. A new
      // visible delivery has a new key and gets its own acknowledgement.
      .catch(() => undefined)
      .finally(() => {
        if (mountedRef.current) setAcknowledging(false);
      });
  }, [acknowledgeInbox, acknowledging, activeTab, documentVisible, isLoading, unreadKey]);

  useEffect(() => {
    const pending = pendingDismissalRef.current;
    if (!pending) return;

    // The acknowledgement may continue in server-side batches. Close only
    // notifications whose rows have already appeared as read reactively.
    const readDeliveryIds = new Set(
      notifications.filter((notification) => notification.isRead).map((notification) => notification.id),
    );
    const acknowledgedDeliveryIds = new Set(
      [...pending.deliveryIds].filter((id) => readDeliveryIds.has(id as Id<'notificationDeliveries'>)),
    );
    if (acknowledgedDeliveryIds.size === 0) return;

    for (const id of acknowledgedDeliveryIds) pending.deliveryIds.delete(id);
    if (pending.deliveryIds.size === 0) pendingDismissalRef.current = null;
    void dismissAcknowledgedWebNotifications(pending.cutoff, acknowledgedDeliveryIds);
  }, [dismissalRevision, notifications]);

  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          Notifications
        </h1>
      }
    >
      <PageFrame className="pt-0">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div>
              <TabsList>
                <TabItem value="inbox" icon={Bell} label="Inbox" />
                <TabItem value="settings" icon={Settings} label="Settings" />
              </TabsList>
            </div>
            <TabPanel value="inbox" className="mt-5">
              <div className="rounded-2xl border border-white/15 bg-background/80 p-4 shadow-2xl backdrop-blur-xl sm:p-5">
                <section className="min-w-0">
                  <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchInput
                      value={search}
                      onValueChange={setSearch}
                      placeholder="Search notifications..."
                      className="w-full"
                      inputClassName="border-white/15 bg-background/85 text-foreground shadow-sm backdrop-blur-xl placeholder:text-muted-foreground focus-visible:bg-background/95"
                    />
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {hasQuery
                        ? `${filteredNotifications.length} of ${notifications.length}`
                        : `${hasUnread ? `${unreadCount} unread` : 'All read'} · ${notifications.length} total`}
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
                    <Elevated offset={1} className="overflow-hidden rounded-xl">
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
                                  'group flex w-full items-start gap-2.5 p-2.5 text-left transition-colors',
                                  'hover:bg-hover focus-visible:relative focus-visible:z-10 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#6B97FF]',
                                  !n.isRead && 'bg-surface-4',
                                )}
                              >
                                <span
                                  className={cn(
                                    'mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border transition-colors',
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
                                      'block text-[13px] font-medium leading-5',
                                      n.isRead ? 'text-muted-foreground' : 'text-foreground',
                                    )}
                                  >
                                    {n.title}
                                  </span>
                                  {n.body ? (
                                    <span className="mt-0.5 block line-clamp-2 text-[11px] leading-[18px] text-muted-foreground">
                                      {n.body}
                                    </span>
                                  ) : null}
                                </span>
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </Elevated>
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
              <div className="rounded-2xl border border-white/15 bg-background/80 p-4 shadow-2xl backdrop-blur-xl sm:p-6">
                <NotificationSettingsPanel />
              </div>
            </TabPanel>
          </Tabs>
        </div>
      </PageFrame>
    </AppShell>
  );
}
