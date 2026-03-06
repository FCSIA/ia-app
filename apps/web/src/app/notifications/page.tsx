'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Bell, CheckCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function NotificationsPage() {
  const qc = useQueryClient();
  const { toast } = useToast();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll().then((r) => r.data),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      toast({ title: 'All marked as read' });
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
  });

  const categoryColors: Record<string, string> = {
    SCHOOL_ANNOUNCEMENT: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
    CLUB_ANNOUNCEMENT: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    EVENT: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    FLEX_FRIDAY: 'bg-foreground/10 text-foreground border-foreground/20',
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Notifications</h1>
            <p className="text-muted-foreground text-sm">Your recent alerts</p>
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

        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : (notifications as any[]).length === 0 ? (
          <Card className="text-center p-16 border-dashed">
            <Bell size={40} className="mx-auto mb-3 opacity-30 text-muted-foreground" />
            <p className="font-medium">No notifications</p>
            <p className="text-sm text-muted-foreground mt-1">You&apos;re all caught up!</p>
          </Card>
        ) : (
          <div className="space-y-2">
            {(notifications as any[]).map((n) => (
              <Card
                key={n.id}
                onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                className={`cursor-pointer transition-all duration-200 ${n.isRead
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
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
