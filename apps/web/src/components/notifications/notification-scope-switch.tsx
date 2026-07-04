'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useMutation, useQuery } from 'convex/react';
import { Switch } from '@/components/ui/switch';
import { api } from '~/apps/convex/src/_generated/api';
import { cn } from '@/lib/utils';
import type { NotificationCategory } from '~/apps/convex/src/validators';

type NotificationScopeSwitchProps = {
  category: NotificationCategory;
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
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const [pending, setPending] = useState(false);
  const [optimisticEnabled, setOptimisticEnabled] = useState<boolean | null>(null);
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

  const preferences = useQuery(api.notifications.preferences.list);

  const preference = preferences?.find(
    (pref) => pref.category === category && pref.scopeKey === resolvedScopeKey,
  );
  const storedEnabled = locked || preferences === undefined || preference?.enabled !== false;
  const enabled = optimisticEnabled ?? storedEnabled;
  const disabled = locked || pending || preferences === undefined;
  const stateLabel = pending ? 'Saving' : preferences === undefined ? '...' : enabled ? 'On' : 'Off';

  if (optimisticEnabled !== null && preferences !== undefined && storedEnabled === optimisticEnabled) {
    setOptimisticEnabled(null);
  }

  const togglePreference = async () => {
    if (disabled) return;
    const nextEnabled = !enabled;
    setPending(true);
    setOptimisticEnabled(nextEnabled);
    try {
      await upsertPreference({
        category,
        enabled: nextEnabled,
        clubId,
        channelId,
        announcementId,
        eventId,
        scopeKey: resolvedScopeKey,
      });
    } catch {
      setOptimisticEnabled(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-3 py-2 transition-colors hover:bg-muted/25',
        compact && 'border-transparent bg-transparent px-0 py-0 hover:bg-transparent',
        locked && 'opacity-80',
        className,
      )}
      title={
        locked
          ? 'Required'
          : preferences === undefined
            ? 'Loading'
            : pending
              ? 'Saving'
              : undefined
      }
    >
      <Switch
        label={compact ? stateLabel : label}
        checked={enabled}
        onToggle={() => void togglePreference()}
        disabled={disabled}
        className="min-w-0 flex-1 px-0 py-0"
      />
      {locked ? <Lock className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}
