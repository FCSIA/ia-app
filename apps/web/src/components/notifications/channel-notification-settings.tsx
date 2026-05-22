'use client';

import { useMemo } from 'react';
import { useMutation as useRestMutation } from '@tanstack/react-query';
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
import { Tooltip } from '@/components/ui/tooltip';
import { api } from '~/apps/convex/src/_generated/api';
import { cn } from '@/lib/utils';

type PreferenceLevel = 'OFF' | 'IN_APP' | 'PUSH' | 'TIME_SENSITIVE';

type ChannelNotificationSettingsProps = {
  clubId: string;
  channelId: string;
  channelName: string;
};

const MESSAGE_CATEGORY = 'CLUB_CHANNEL_MESSAGE';
const DIRECT_CATEGORY = 'CLUB_CHANNEL_MENTION';
const TAG_CATEGORY = 'CLUB_CHANNEL_TAG_MENTION';
const THREAD_CATEGORY = 'CLUB_CHANNEL_THREAD';

const messageOptions: Array<{
  value: PreferenceLevel;
  label: string;
  detail: string;
  icon: typeof Bell;
}> = [
  {
    value: 'OFF',
    label: 'No all-message alerts',
    detail: 'Only direct mentions, tag mentions, and thread replies can notify you.',
    icon: BellOff,
  },
  {
    value: 'IN_APP',
    label: 'Inbox only',
    detail: 'Show every message in notifications without future push escalation.',
    icon: MessageSquare,
  },
  {
    value: 'PUSH',
    label: 'Push',
    detail: 'Treat every message in this channel as push-worthy.',
    icon: Bell,
  },
  {
    value: 'TIME_SENSITIVE',
    label: 'Time sensitive',
    detail: 'Reserve for one-off channels where every update matters.',
    icon: Radio,
  },
];

const mentionOptions: Array<{
  category: string;
  label: string;
  detail: string;
  icon: typeof Bell;
}> = [
  {
    category: DIRECT_CATEGORY,
    label: 'Direct mentions',
    detail: 'When someone mentions your unique ID.',
    icon: Bell,
  },
  {
    category: TAG_CATEGORY,
    label: 'Tag mentions',
    detail: 'When someone mentions @all, @leaders, @sponsors, or a custom tag you belong to.',
    icon: Tags,
  },
  {
    category: THREAD_CATEGORY,
    label: 'Thread replies',
    detail: 'When someone replies to your message thread.',
    icon: MessageSquare,
  },
];

function scopePreference(preferences: any[], category: string, channelId: string) {
  return preferences.find(
    (preference) =>
      preference.category === category && preference.scopeKey === `channel:${channelId}`,
  );
}

function preferenceEnabled(preferences: any[], category: string, channelId: string) {
  const preference = scopePreference(preferences, category, channelId);
  return preference ? preference.enabled && preference.level !== 'OFF' : true;
}

export function ChannelNotificationSettings({
  clubId,
  channelId,
  channelName,
}: ChannelNotificationSettingsProps) {
  const upsertPreference = useMutation(api.notifications.upsertPreference);
  const preferences = useQuery(api.notifications.preferences) ?? [];

  const messagePreference = scopePreference(preferences, MESSAGE_CATEGORY, channelId);
  const messageLevel: PreferenceLevel = messagePreference?.enabled
    ? messagePreference.level ?? 'PUSH'
    : 'OFF';

  const summary = useMemo(() => {
    if (messageLevel === 'TIME_SENSITIVE') return 'Time sensitive';
    if (messageLevel === 'PUSH') return 'All messages';
    if (messageLevel === 'IN_APP') return 'Inbox only';
    return 'Mentions';
  }, [messageLevel]);

  const mutation = useRestMutation({
    mutationFn: ({
      category,
      level,
    }: {
      category: string;
      level: PreferenceLevel;
    }) =>
      upsertPreference({
        category: category as any,
        enabled: level !== 'OFF',
        clubId,
        channelId,
        level,
      }),
  });

  return (
    <Sheet>
      <Tooltip content="Channel notification settings">
        <SheetTrigger asChild>
          <Button variant="tertiary" size="icon-sm" aria-label="Channel notification settings">
            <Bell className="size-4" />
          </Button>
        </SheetTrigger>
      </Tooltip>
      <SheetContent side="right" className="flex w-full flex-col gap-6 p-5 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Notifications</SheetTitle>
          <SheetDescription>
            #{channelName} · {summary}
          </SheetDescription>
        </SheetHeader>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">All messages</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              Use this for channels that should break through normal mention-only behavior.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {messageOptions.map((option, index) => {
              const Icon = option.icon;
              const selected = messageLevel === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-proximity-index={index}
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                    selected ? 'bg-muted/70 text-foreground' : 'text-muted-foreground',
                  )}
                  onClick={() =>
                    mutation.mutate({ category: MESSAGE_CATEGORY, level: option.value })
                  }
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                      selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    <Icon className="size-3" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-foreground">{option.label}</span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {option.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">Mentions and replies</h3>
            <p className="text-xs leading-5 text-muted-foreground">
              These stay separate from all-message alerts so important mentions can remain on.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            {mentionOptions.map((option) => {
              const enabled = preferenceEnabled(preferences, option.category, channelId);
              const Icon = option.icon;
              return (
                <button
                  key={option.category}
                  type="button"
                  className={cn(
                    'flex items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-muted/60',
                    enabled ? 'text-foreground' : 'text-muted-foreground',
                  )}
                  onClick={() =>
                    mutation.mutate({
                      category: option.category,
                      level: enabled ? 'OFF' : 'PUSH',
                    })
                  }
                >
                  <span
                    className={cn(
                      'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border',
                      enabled ? 'border-primary bg-primary text-primary-foreground' : 'border-border',
                    )}
                  >
                    <Icon className="size-3" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{option.label}</span>
                    <span className="block text-xs leading-5 text-muted-foreground">
                      {option.detail}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </SheetContent>
    </Sheet>
  );
}
