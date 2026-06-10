'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings';
import { NotificationScopeSwitch } from '@/components/notifications/notification-scope-switch';
import {
  AtSign,
  BellRing,
  CalendarDays,
  Hash,
  Megaphone,
  ShieldAlert,
  Sparkles,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { NotificationCategory } from '~/apps/convex/src/validators';

const GLOBAL_SETTINGS: Array<{
  category: NotificationCategory;
  label: string;
  Icon: LucideIcon;
}> = [
  {
    category: 'SCHOOL_ANNOUNCEMENT',
    label: 'School announcements',
    Icon: Megaphone,
  },
  {
    category: 'EVENT',
    label: 'Events',
    Icon: CalendarDays,
  },
  {
    category: 'FLEX_FRIDAY',
    label: 'Flex Friday',
    Icon: Sparkles,
  },
  {
    category: 'FRIEND_REQUEST',
    label: 'Friend schedules',
    Icon: Users,
  },
  {
    category: 'CONTENT_MODERATED',
    label: 'Moderation notices',
    Icon: ShieldAlert,
  },
];

export function NotificationSettingsPanel() {
  const myClubs = useQuery(api.clubs.management.getMyClubs);

  const involvedClubs = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    const seen = new Set<string>();
    return entries.filter((club) => {
      if (seen.has(club._id)) return false;
      seen.add(club._id);
      return true;
    });
  }, [myClubs]);

  const clubsLoading = myClubs === undefined;

  return (
    <div className="flex flex-col gap-6">
      <PushNotificationSettings />
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <BellRing className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Global</h2>
        </div>
        <div className="flex flex-col gap-1">
          {GLOBAL_SETTINGS.map((setting) => {
            const Icon = setting.Icon;
            return (
              <div
                key={setting.category}
                className="flex min-w-0 items-center justify-between gap-3 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="truncate text-sm font-medium text-foreground">{setting.label}</p>
                </div>
                <NotificationScopeSwitch
                  category={setting.category}
                  label={setting.label}
                  compact
                  className="shrink-0"
                />
              </div>
            );
          })}
          <div
            title="Required"
            className="flex min-w-0 items-center justify-between gap-3 py-1.5"
          >
            <div className="flex min-w-0 items-center gap-2">
              <ShieldAlert className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <p className="truncate text-sm font-medium text-foreground">Admin broadcast push</p>
            </div>
            <NotificationScopeSwitch
              category="SCHOOL_ANNOUNCEMENT"
              label="Admin broadcast push"
              scopeKey="admin-push"
              locked
              compact
              className="shrink-0"
            />
          </div>
        </div>
      </section>
      <section className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <AtSign className="size-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold">Clubs</h2>
        </div>
        {clubsLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : involvedClubs.length > 0 ? (
          <div className="flex flex-col gap-4">
            {involvedClubs.map((club) => (
              <ClubNotificationChannels key={club._id} clubId={club._id} clubName={club.name} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No clubs.</p>
        )}
      </section>
    </div>
  );
}

function ClubNotificationChannels({
  clubId,
  clubName,
}: {
  clubId: Id<'clubs'>;
  clubName: string;
}) {
  const channels = useQuery(api.clubs.channels.list, { clubId }) ?? [];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Megaphone className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <p className="truncate text-sm font-semibold text-foreground">{clubName}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Visible channels">
            {channels.length}
          </span>
        </div>
        <NotificationScopeSwitch
          category="CLUB_ANNOUNCEMENT"
          label="Announcements"
          clubId={clubId}
          compact
          className="shrink-0"
        />
      </div>
      {channels.length > 0 ? (
        <div className="grid gap-1 pl-6">
          {channels.map((channel) => (
            <div
              key={channel._id}
              className="flex min-w-0 items-center justify-between gap-3 py-1"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Hash className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <p className="truncate text-sm font-medium">#{channel.name}</p>
              </div>
              <NotificationScopeSwitch
                category="CLUB_CHANNEL_MENTION"
                label={`${channel.name} mentions`}
                clubId={clubId}
                channelId={channel._id}
                compact
                className="shrink-0"
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="pl-6 text-xs text-muted-foreground">No channels.</p>
      )}
    </div>
  );
}
