'use client';

import { Bell, BellOff, Lock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { notificationsApi } from '@/lib/api';
import { cn } from '@/lib/utils';

type NotificationScopeSwitchProps = {
  category: string;
  label: string;
  clubId?: string;
  channelId?: string;
  announcementId?: string;
  eventId?: string;
  scopeKey?: string;
  locked?: boolean;
  compact?: boolean;
  className?: string;
};

export function NotificationScopeSwitch({
  category,
  label,
  clubId,
  channelId,
  announcementId,
  eventId,
  scopeKey,
  locked = false,
  compact = false,
  className,
}: NotificationScopeSwitchProps) {
  const queryClient = useQueryClient();
  const resolvedScopeKey =
    scopeKey ??
    (channelId
      ? `channel:${channelId}`
      : announcementId
        ? `announcement:${announcementId}`
        : eventId
          ? `event:${eventId}`
          : clubId
            ? `club:${clubId}`
            : 'global');

  const { data: preferences = [] } = useQuery<any[]>({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences().then((response) => response.data),
  });

  const preference = preferences.find(
    (pref) => pref.category === category && pref.scopeKey === resolvedScopeKey,
  );
  const enabled = locked || preference?.enabled !== false;

  const mutation = useMutation({
    mutationFn: () =>
      notificationsApi.upsertPreference(category, !enabled, {
        clubId,
        channelId,
        announcementId,
        eventId,
        scopeKey: resolvedScopeKey,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
    },
  });

  return (
    <Button
      type="button"
      variant={enabled ? 'secondary' : 'outline'}
      size={compact ? 'sm' : 'default'}
      className={cn('justify-start gap-2', className)}
      disabled={locked || mutation.isPending}
      onClick={() => mutation.mutate()}
      title={locked ? 'Push notifications to everyone cannot be disabled' : undefined}
    >
      {locked ? (
        <Lock className="size-4" />
      ) : enabled ? (
        <Bell className="size-4" />
      ) : (
        <BellOff className="size-4" />
      )}
      {compact ? (enabled ? 'On' : 'Off') : label}
    </Button>
  );
}
