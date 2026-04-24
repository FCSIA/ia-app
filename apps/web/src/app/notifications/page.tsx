'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { CheckCheck, Search, X } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';

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
      const searchable = [
        n.title,
        n.body,
        n.category,
      ].filter(Boolean).join(' ').toLowerCase();
      
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

  const categoryColors: Record<string, string> = {
    SCHOOL_ANNOUNCEMENT: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    CLUB_ANNOUNCEMENT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    CLUB_JOIN_REQUEST: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25',
    EVENT: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    FLEX_FRIDAY: 'bg-foreground/10 text-foreground border-foreground/20',
    CLUB_CHANNEL_MENTION: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/25',
    CONTENT_MODERATED: 'bg-red-500/15 text-red-400 border-red-500/25',
    FRIEND_REQUEST: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
  };

  function getNotificationHref(notification: any) {
    if (notification.channelId && notification.clubId) {
      return `/clubs/${notification.clubId}/channels/${notification.channelId}`;
    }

    if (notification.announcementId) {
      return `/announcements/${notification.announcementId}`;
    }

    if (notification.eventId) {
      return '/events';
    }

    if (notification.category === 'FRIEND_REQUEST') {
      return '/schedule?tab=friends&section=requests';
    }

    if (notification.category === 'CONTENT_MODERATED') {
      return '/profile';
    }

    if (notification.category === 'FLEX_FRIDAY') {
      return '/flex-friday';
    }

    if (notification.clubId) {
      return `/clubs/${notification.clubId}`;
    }

    return null;
  }

  function openNotification(notification: any) {
    const href = getNotificationHref(notification);

    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }

    if (href) {
      router.push(href);
    }
  }

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
          </div>
          {(notifications as any[]).some((n: any) => !n.isRead) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="flex items-center gap-2"
            >
              <CheckCheck size={16} /> Mark all read
            </Button>
          )}
        </div>

        <div className="mb-6 border-b pb-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-11 border-0 bg-transparent pl-9 pr-9 text-base shadow-none focus-visible:ring-0"
              placeholder="Search notifications..."
            />
            {search ? (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : filteredNotifications.length === 0 ? (
          <Card className="text-center p-16 border-dashed">
            <Search size={40} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="font-medium">No results found</p>
            <p className="text-sm text-muted-foreground mt-1">Try a different search term.</p>
            <Button variant="link" size="sm" onClick={() => setSearch('')} className="mt-2 font-semibold text-accent-500">
              Clear search
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredNotifications.map((n: any) => (
              (() => {
                const href = getNotificationHref(n);
                const isClickable = !!href;

                return (
                  <Card
                    key={n.id}
                    onClick={() => openNotification(n)}
                    onKeyDown={(event) => {
                      if (!isClickable) return;
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openNotification(n);
                      }
                    }}
                    role={isClickable ? 'link' : undefined}
                    tabIndex={isClickable ? 0 : undefined}
                    aria-label={isClickable ? `Open notification: ${n.title}` : undefined}
                    className={`${isClickable ? 'cursor-pointer' : 'cursor-default'} transition-all duration-200 ${n.isRead
                      ? 'opacity-60 bg-transparent shadow-none border-border/50'
                      : 'bg-accent/30 hover:bg-accent/50 hover:-translate-y-0.5 border-accent-500/20'
                      }`}
                  >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    {/* Read indicator dot */}
                    <div
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 transition-colors ${n.isRead ? 'bg-muted-foreground/30' : 'bg-accent-500'
                        }`}
                      style={!n.isRead ? { boxShadow: '0 0 8px rgba(249,115,22,0.6)' } : undefined}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <Badge variant="outline" className={`text-[10px] ${categoryColors[n.category] || categoryColors.FLEX_FRIDAY}`}>
                          {n.category.replace(/_/g, ' ')}
                        </Badge>
                      </div>
                      <p className={`font-medium text-sm ${n.isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {n.title}
                      </p>
                      {n.body && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{n.body}</p>
                      )}
                      <p className="text-[11px] text-muted-foreground/60 mt-2">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                      {href ? (
                        <p className="mt-2 text-[11px] font-medium text-accent-500">
                          Open
                        </p>
                      ) : null}
                    </div>
                  </div>
                </CardContent>
                  </Card>
                );
              })()
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
