'use client';

import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { Bell, CheckCheck } from 'lucide-react';

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.getAll().then((r) => r.data),
  });

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] });
      toast.success('All marked as read');
    },
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead([id]),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications', 'unread-count'] }),
  });

  const categoryColors: Record<string, string> = {
    SCHOOL_ANNOUNCEMENT: 'badge-blue',
    CLUB_ANNOUNCEMENT: 'badge-green',
    EVENT: 'badge-yellow',
    FLEX_FRIDAY: 'badge-gray',
  };

  return (
    <AppShell>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Notifications</h1>
            <p className="text-white/45 text-sm">Your recent alerts</p>
          </div>
          {(notifications as any[]).some((n: any) => !n.isRead) && (
            <button
              onClick={() => markAllMutation.mutate()}
              disabled={markAllMutation.isPending}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <CheckCheck size={16} /> Mark all read
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12 text-white/35">Loading…</div>
        ) : (notifications as any[]).length === 0 ? (
          <div className="card text-center py-16 text-white/30">
            <Bell size={40} className="mx-auto mb-3 opacity-30" />
            <p className="font-medium">No notifications</p>
            <p className="text-sm text-white/20 mt-1">You're all caught up!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {(notifications as any[]).map((n) => (
              <div
                key={n.id}
                onClick={() => !n.isRead && markReadMutation.mutate(n.id)}
                className={`card cursor-pointer transition-all duration-200 ${
                  n.isRead
                    ? 'opacity-55'
                    : 'border-accent-500/20 hover:border-accent-500/35 hover:-translate-y-0.5'
                }`}
                style={!n.isRead ? { background: 'rgba(249,115,22,0.04)' } : undefined}
              >
                <div className="flex items-start gap-3">
                  {/* Read indicator dot */}
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 transition-colors ${
                      n.isRead ? 'bg-white/15' : 'bg-accent-500'
                    }`}
                    style={!n.isRead ? { boxShadow: '0 0 8px rgba(249,115,22,0.6)' } : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={categoryColors[n.category] || 'badge-gray'}>
                        {n.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className={`font-medium text-sm ${n.isRead ? 'text-white/60' : 'text-white/90'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-white/40 mt-0.5 line-clamp-2">{n.body}</p>
                    )}
                    <p className="text-xs text-white/25 mt-1.5">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
