'use client';

import { Lock } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Switch } from '@/components/ui/switch';
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
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/20 px-3 py-2',
        compact && 'rounded-xl px-2 py-1.5',
        locked && 'opacity-80',
        className,
      )}
      title={locked ? 'Push notifications to everyone cannot be disabled' : undefined}
    >
      <Switch
        label={compact ? (enabled ? 'On' : 'Off') : label}
        checked={enabled}
        onToggle={() => mutation.mutate()}
        disabled={locked || mutation.isPending}
        className="min-w-0 flex-1 px-0 py-0"
      />
      {locked ? <Lock className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}
