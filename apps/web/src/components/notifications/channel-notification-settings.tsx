'use client';

import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { ArrowLeft, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Tooltip } from '@/components/ui/tooltip';
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

const CHANNEL_CATEGORIES = [
  MESSAGE_CATEGORY,
  DIRECT_CATEGORY,
  TAG_CATEGORY,
  THREAD_CATEGORY,
] as const;

type NotificationMode = 'default' | 'all' | 'mentions' | 'nothing';

const MUTE_DURATIONS = [
  { label: 'For 15 minutes', duration: 15 * 60_000 },
  { label: 'For 1 hour', duration: 60 * 60_000 },
  { label: 'For 3 hours', duration: 3 * 60 * 60_000 },
  { label: 'For 8 hours', duration: 8 * 60 * 60_000 },
  { label: 'For 24 hours', duration: 24 * 60 * 60_000 },
  { label: 'Until I turn it back on', duration: null },
] as const;

const NOTIFICATION_MODES: Array<{ value: NotificationMode; label: string }> = [
  { value: 'default', label: 'Club default' },
  { value: 'all', label: 'All messages' },
  { value: 'mentions', label: 'Only @mentions' },
  { value: 'nothing', label: 'Nothing' },
];

type NotificationPreference = {
  category: NotificationCategory;
  scopeKey: string;
  enabled: boolean;
  level: PreferenceLevel;
  isMuted: boolean;
  mutedUntil: number | null;
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

function storedNotificationMode(
  preferences: NotificationPreference[],
  channelId: string,
): NotificationMode {
  const hasChannelOverride = CHANNEL_CATEGORIES.some((category) =>
    scopePreference(preferences, category, channelId),
  );
  if (!hasChannelOverride) return 'default';

  const messageLevel = storedPreferenceLevel(
    preferences,
    MESSAGE_CATEGORY,
    channelId,
    'OFF',
  );
  if (messageLevel !== 'OFF') return 'all';

  const mentionsEnabled = [DIRECT_CATEGORY, TAG_CATEGORY, THREAD_CATEGORY].some(
    (category) =>
      storedPreferenceLevel(preferences, category, channelId, 'PUSH') !== 'OFF',
  );
  return mentionsEnabled ? 'mentions' : 'nothing';
}

export function ChannelNotificationSettings({
  clubId,
  channelId,
  channelName,
}: ChannelNotificationSettingsProps) {
  const { toast } = useToast();
  const upsertPreference = useMutation(api.notifications.preferences.upsert);
  const resetChannel = useMutation(api.notifications.preferences.resetChannel);
  const setChannelMute = useMutation(api.notifications.preferences.setChannelMute);
  const preferences =
    useQuery(api.notifications.preferences.list) ?? EMPTY_NOTIFICATION_PREFERENCES;
  const modeRequestVersion = useRef(0);
  const muteRequestVersion = useRef(0);
  const [optimisticMode, setOptimisticMode] = useState<NotificationMode | null>(null);
  const [optimisticMuted, setOptimisticMuted] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<'settings' | 'mute'>('settings');

  const storedMode = storedNotificationMode(preferences, channelId);
  const mode = optimisticMode ?? storedMode;
  const mutePreference = preferences.find(
    (preference) =>
      preference.category === MESSAGE_CATEGORY &&
      preference.scopeKey === `mute:channel:${channelId}`,
  );
  const storedMuted = Boolean(
    mutePreference?.isMuted &&
      (mutePreference.mutedUntil == null || mutePreference.mutedUntil > Date.now()),
  );
  const muted = optimisticMuted ?? storedMuted;

  useEffect(() => {
    if (optimisticMode !== null && optimisticMode === storedMode) {
      setOptimisticMode(null);
    }
  }, [optimisticMode, storedMode]);

  useEffect(() => {
    if (optimisticMuted !== null && optimisticMuted === storedMuted) {
      setOptimisticMuted(null);
    }
  }, [optimisticMuted, storedMuted]);

  const setMode = async (nextMode: NotificationMode) => {
    const requestVersion = modeRequestVersion.current + 1;
    modeRequestVersion.current = requestVersion;
    setOptimisticMode(nextMode);
    try {
      if (nextMode === 'default') {
        await resetChannel({ channelId });
      } else {
        const levels: Partial<Record<NotificationCategory, PreferenceLevel>> = {
          [MESSAGE_CATEGORY]: nextMode === 'all' ? 'PUSH' : 'OFF',
          [DIRECT_CATEGORY]: nextMode === 'nothing' ? 'OFF' : 'PUSH',
          [TAG_CATEGORY]: nextMode === 'nothing' ? 'OFF' : 'PUSH',
          [THREAD_CATEGORY]: nextMode === 'nothing' ? 'OFF' : 'PUSH',
        };
        await Promise.all(
          CHANNEL_CATEGORIES.map((category) =>
            upsertPreference({
              category,
              enabled: levels[category]! !== 'OFF',
              clubId,
              channelId,
              level: levels[category]!,
            }),
          ),
        );
      }
    } catch (error) {
      if (modeRequestVersion.current !== requestVersion) return;
      setOptimisticMode(null);
      toast({
        title: error instanceof Error ? error.message : 'Could not update channel alerts',
        variant: 'destructive',
      });
    }
  };

  const setMuted = async (nextMuted: boolean, duration: number | null = null) => {
    const requestVersion = muteRequestVersion.current + 1;
    muteRequestVersion.current = requestVersion;
    setOptimisticMuted(nextMuted);
    try {
      await setChannelMute({
        clubId,
        channelId,
        muted: nextMuted,
        mutedUntil: nextMuted && duration !== null ? Date.now() + duration : null,
      });
    } catch (error) {
      if (muteRequestVersion.current !== requestVersion) return;
      setOptimisticMuted(null);
      toast({
        title: error instanceof Error ? error.message : 'Could not update channel mute',
        variant: 'destructive',
      });
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setView('settings');
      }}
    >
      <Tooltip content="Channel notification settings">
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon-sm" aria-label="Channel notification settings">
            {muted ? <BellOff className="size-4" /> : <Bell className="size-4" />}
          </Button>
        </PopoverTrigger>
      </Tooltip>
      <PopoverContent
        align="start"
        collisionPadding={8}
        className="w-72 max-w-[calc(100vw-1rem)] p-2"
      >
        {view === 'mute' ? (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1 px-1 pb-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Back to notification settings"
                onClick={() => setView('settings')}
              >
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">Mute #{channelName}</p>
                <p className="text-xs text-muted-foreground">Choose how long.</p>
              </div>
            </div>
            {MUTE_DURATIONS.map((option) => (
              <Button
                key={option.label}
                type="button"
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  void setMuted(true, option.duration);
                  setOpen(false);
                }}
              >
                {option.label}
              </Button>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="px-2 pt-1">
              <p className="truncate text-sm font-semibold">#{channelName}</p>
              <p className="text-xs text-muted-foreground">
                {muted
                  ? 'Muted'
                  : mode === 'default'
                    ? 'Using club defaults'
                    : `${mode} notifications`}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                if (muted) {
                  void setMuted(false);
                  setOpen(false);
                } else {
                  setView('mute');
                }
              }}
            >
              {muted ? <Bell /> : <BellOff />}
              {muted ? 'Unmute channel' : 'Mute channel'}
            </Button>
            <Separator />
            <RadioGroup
              value={mode}
              onValueChange={(value) => {
                void setMode(value as NotificationMode);
                setOpen(false);
              }}
              className="w-full"
            >
              {NOTIFICATION_MODES.map((option, index) => (
                <RadioItem
                  key={option.value}
                  index={index}
                  value={option.value}
                  label={option.label}
                />
              ))}
            </RadioGroup>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
