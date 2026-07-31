'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { Bell, BellOff, MessageSquare, Radio, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tooltip } from '@/components/ui/tooltip';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { api } from '~/apps/convex/src/_generated/api';
import type { NotificationCategory, NotificationPreferenceLevel } from '~/apps/convex/src/validators';
import { useToast } from '@/hooks/use-toast';

type PreferenceLevel = NotificationPreferenceLevel;

type ChannelNotificationSettingsProps = {
  clubId: string;
  channelId: string;
  channelName: string;
};

const MESSAGE_CATEGORY: NotificationCategory = 'CLUB_CHANNEL_MESSAGE';
const DIRECT_CATEGORY: NotificationCategory = 'CLUB_CHANNEL_MENTION';
const TAG_CATEGORY: NotificationCategory = 'CLUB_CHANNEL_TAG_MENTION';
const THREAD_CATEGORY: NotificationCategory = 'CLUB_CHANNEL_THREAD';

const messageOptions: Array<{
  value: PreferenceLevel;
  label: string;
  icon: typeof Bell;
}> = [
  {
    value: 'OFF',
    label: 'Mentions',
    icon: BellOff,
  },
  {
    value: 'IN_APP',
    label: 'Inbox',
    icon: MessageSquare,
  },
  {
    value: 'PUSH',
    label: 'Push',
    icon: Bell,
  },
  {
    value: 'TIME_SENSITIVE',
    label: 'Urgent',
    icon: Radio,
  },
];

const mentionOptions: Array<{
  category: NotificationCategory;
  label: string;
  icon: typeof Bell;
}> = [
  {
    category: DIRECT_CATEGORY,
    label: 'Direct mentions',
    icon: Bell,
  },
  {
    category: TAG_CATEGORY,
    label: 'Group mentions',
    icon: Tags,
  },
  {
    category: THREAD_CATEGORY,
    label: 'Thread replies',
    icon: MessageSquare,
  },
];

type NotificationPreference = {
  category: NotificationCategory;
  scopeKey: string;
  enabled: boolean;
  level: PreferenceLevel;
};

const EMPTY_NOTIFICATION_PREFERENCES: NotificationPreference[] = [];

function scopePreference(
  preferences: NotificationPreference[],
  category: NotificationCategory,
  channelId: string,
) {
  return preferences.find(
    (preference) =>
      preference.category === category && preference.scopeKey === `channel:${channelId}`,
  );
}

function storedPreferenceLevel(
  preferences: NotificationPreference[],
  category: NotificationCategory,
  channelId: string,
  fallback: PreferenceLevel,
) {
  const preference = scopePreference(preferences, category, channelId);
  return preference
    ? preference.enabled
      ? preference.level
      : 'OFF'
    : fallback;
}

export function ChannelNotificationSettings({
  clubId,
  channelId,
  channelName,
}: ChannelNotificationSettingsProps) {
  const { toast } = useToast();
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const preferences =
    useQuery(api.notifications.preferences.list) ?? EMPTY_NOTIFICATION_PREFERENCES;
  const [optimisticLevels, setOptimisticLevels] = useState<
    Partial<Record<NotificationCategory, PreferenceLevel>>
  >({});
  const requestVersions = useRef<Partial<Record<NotificationCategory, number>>>({});

  const messageLevel =
    optimisticLevels[MESSAGE_CATEGORY] ??
    storedPreferenceLevel(preferences, MESSAGE_CATEGORY, channelId, 'OFF');

  useEffect(() => {
    setOptimisticLevels((current) => {
      let changed = false;
      const next = { ...current };
      for (const [category, level] of Object.entries(current)) {
        const fallback = category === MESSAGE_CATEGORY ? 'OFF' : 'PUSH';
        const storedLevel = storedPreferenceLevel(
          preferences,
          category as NotificationCategory,
          channelId,
          fallback,
        );
        if (storedLevel === level) {
          delete next[category as NotificationCategory];
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [channelId, preferences]);

  const summary = useMemo(() => {
    if (messageLevel === 'TIME_SENSITIVE') return 'Time sensitive';
    if (messageLevel === 'PUSH') return 'All messages';
    if (messageLevel === 'IN_APP') return 'Inbox only';
    return 'Mentions';
  }, [messageLevel]);

  const setPreference = async ({
    category,
    level,
  }: {
    category: NotificationCategory;
    level: PreferenceLevel;
  }) => {
    const requestVersion = (requestVersions.current[category] ?? 0) + 1;
    requestVersions.current[category] = requestVersion;
    setOptimisticLevels((current) => ({ ...current, [category]: level }));
    try {
      const saved = await upsertPreference({
        category,
        enabled: level !== 'OFF',
        clubId,
        channelId,
        level,
      });
      if (requestVersions.current[category] !== requestVersion) return;
      const confirmedLevel = saved.enabled ? saved.level : 'OFF';
      setOptimisticLevels((current) => ({
        ...current,
        [category]: confirmedLevel,
      }));
    } catch (error) {
      if (requestVersions.current[category] !== requestVersion) return;
      setOptimisticLevels((current) => {
        const next = { ...current };
        delete next[category];
        return next;
      });
      toast({
        title: error instanceof Error ? error.message : 'Could not update channel alerts',
        variant: 'destructive',
      });
    }
  };

  return (
    <Sheet>
      <Tooltip content="Channel notification settings">
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Channel notification settings">
            <Bell className="size-4" />
          </Button>
        </SheetTrigger>
      </Tooltip>
      <SheetContent
        side="right"
        overlayClassName="bg-foreground/30 backdrop-blur-[1px]"
        className="flex w-full flex-col gap-5 p-5 data-[state=closed]:duration-200 data-[state=open]:duration-300 sm:max-w-sm"
      >
        <SheetHeader>
          <SheetTitle>Channel alerts</SheetTitle>
          <SheetDescription>
            #{channelName} · {summary}
          </SheetDescription>
        </SheetHeader>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Notify me for</h3>
          <ToggleGroup
            type="single"
            value={messageLevel}
            onValueChange={(level) => {
              if (level) {
                void setPreference({
                  category: MESSAGE_CATEGORY,
                  level: level as PreferenceLevel,
                });
              }
            }}
            variant="outline"
            className="grid grid-cols-4 gap-1 rounded-xl bg-muted/40 p-1"
            aria-label="All-message notification level"
          >
            {messageOptions.map((option) => {
              const Icon = option.icon;
              return (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  aria-label={option.label}
                  className="h-auto min-w-0 flex-col gap-1 rounded-lg border-0 px-1.5 py-2 text-[11px] text-muted-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
                >
                  <Icon className="size-4" />
                  <span className="truncate">{option.label}</span>
                </ToggleGroupItem>
              );
            })}
          </ToggleGroup>
          <p className="text-xs leading-5 text-muted-foreground">
            Mentions keeps the channel quiet unless someone needs you.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium text-foreground">Always notify</h3>
          <div className="divide-y rounded-xl border bg-card">
            {mentionOptions.map((option) => {
              const level =
                optimisticLevels[option.category] ??
                storedPreferenceLevel(preferences, option.category, channelId, 'PUSH');
              const enabled = level !== 'OFF';
              const Icon = option.icon;
              return (
                <div
                  key={option.category}
                  className="flex items-center gap-3 px-3 py-3"
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">
                    {option.label}
                  </span>
                  <Switch
                    checked={enabled}
                    aria-label={option.label}
                    onCheckedChange={(checked) =>
                      void setPreference({
                        category: option.category,
                        level: checked ? 'PUSH' : 'OFF',
                      })
                    }
                  />
                </div>
              );
            })}
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
