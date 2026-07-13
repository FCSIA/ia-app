'use client';

import { useEffect, useState } from 'react';
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
  defaultEnabled?: boolean;
  locked?: boolean;
  compact?: boolean;
  className?: string;
  parentEnabled?: boolean;
  onOptimisticChange?: (enabled: boolean | null) => void;
};

export function NotificationScopeSwitch({
  category,
  label,
  clubId,
  channelId,
  announcementId,
  eventId,
  scopeKey,
  defaultEnabled = true,
  locked: lockedProp = false,
  compact = false,
  className,
  parentEnabled = true,
  onOptimisticChange,
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
  const locked = lockedProp || preference?.locked === true;
  const storedEnabled = locked
    || (preferences === undefined ? defaultEnabled : preference ? preference.enabled !== false : defaultEnabled);
  const enabled = parentEnabled && (optimisticEnabled ?? storedEnabled);
  const disabled = locked || !parentEnabled || pending || preferences === undefined;

  useEffect(() => {
    if (optimisticEnabled !== null && preferences !== undefined && storedEnabled === optimisticEnabled) {
      setOptimisticEnabled(null);
      onOptimisticChange?.(null);
    }
  }, [onOptimisticChange, optimisticEnabled, preferences, storedEnabled]);

  const togglePreference = async (nextEnabled: boolean) => {
    if (disabled) return;
    setPending(true);
    setOptimisticEnabled(nextEnabled);
    onOptimisticChange?.(nextEnabled);
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
      onOptimisticChange?.(null);
    } finally {
      setPending(false);
    }
  };

  return (
    <div
      className={cn(
        'flex min-w-0 items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/25',
        compact && 'px-0 py-0 hover:bg-transparent',
        locked && 'opacity-80',
        className,
      )}
      title={
        locked
          ? 'This notification is required'
          : !parentEnabled
            ? 'Turn on club notifications to change this channel'
          : preferences === undefined
            ? 'Loading'
            : pending
              ? 'Saving'
              : undefined
      }
    >
      <Switch
        label={compact ? undefined : label}
        aria-label={`${label}: ${enabled ? 'on' : 'off'}`}
        checked={enabled}
        onCheckedChange={(nextEnabled) => void togglePreference(nextEnabled)}
        disabled={disabled}
        wrapperClassName="min-w-0 flex-1"
      />
      {locked ? <Lock className="size-4 shrink-0 text-muted-foreground" /> : null}
    </div>
  );
}
