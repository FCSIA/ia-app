'use client';

import { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings';
import { NOTIFICATION_CATEGORY_OPTIONS } from '@/components/notifications/notification-category-options';
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
import { hasRole, isSuperAdmin, useCurrentUser } from '@/lib/auth';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import type { NotificationCategory } from '~/apps/convex/src/validators';

const CATEGORY_ICONS: Record<NotificationCategory, LucideIcon> = {
  SCHOOL_ANNOUNCEMENT: Megaphone,
  CLUB_ANNOUNCEMENT: Megaphone,
  CLUB_JOIN_REQUEST: Users,
  CLUB_CHANNEL_MESSAGE: BellRing,
  CLUB_CHANNEL_MENTION: AtSign,
  CLUB_CHANNEL_TAG_MENTION: Hash,
  CLUB_CHANNEL_THREAD: Hash,
  EVENT: CalendarDays,
  FLEX_FRIDAY: Sparkles,
  CONTENT_MODERATED: ShieldAlert,
  FRIEND_REQUEST: Users,
};

export function NotificationSettingsPanel() {
  const user = useCurrentUser();
  const hasAdministrativeClubAccess = isSuperAdmin(user);
  const myClubs = useQuery(
    api.clubs.management.getMyClubs,
    hasAdministrativeClubAccess ? 'skip' : {},
  );
  const canSeeStaffCategories = hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT_ADMIN');

  const involvedClubs = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    const seen = new Set<string>();
    return entries.filter((club) => {
      if (seen.has(club._id)) return false;
      seen.add(club._id);
      return true;
    });
  }, [myClubs]);

  const globalSettings = useMemo(
    () =>
      NOTIFICATION_CATEGORY_OPTIONS.filter(
        (category) => !category.staffOnly || canSeeStaffCategories,
      ),
    [canSeeStaffCategories],
  );

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
          {globalSettings.map((setting) => {
            const Icon = CATEGORY_ICONS[setting.key];
            return (
              <div
                key={setting.key}
                className="flex min-w-0 items-center justify-between gap-3 py-1.5"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <p className="truncate text-sm font-medium text-foreground">{setting.label}</p>
                </div>
                <NotificationScopeSwitch
                  category={setting.key}
                  label={setting.label}
                  defaultEnabled={setting.defaultEnabled}
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
      {!hasAdministrativeClubAccess ? (
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
      ) : null}
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
  const preferences = useQuery(api.notifications.preferences.list);
  const [optimisticClubEnabled, setOptimisticClubEnabled] = useState<boolean | null>(null);
  const [optimisticChannelEnabled, setOptimisticChannelEnabled] = useState<
    Record<string, boolean>
  >({});
  const clubScopeKey = `club:${clubId}`;
  const clubPreference = preferences?.find(
    (preference) =>
      preference.category === 'CLUB_ANNOUNCEMENT' &&
      preference.scopeKey === clubScopeKey,
  );
  const globalClubPreference = preferences?.find(
    (preference) =>
      preference.category === 'CLUB_ANNOUNCEMENT' && preference.scopeKey === 'global',
  );
  const storedClubEnabled =
    (clubPreference ?? globalClubPreference)?.enabled !== false;
  const clubEnabled = optimisticClubEnabled ?? storedClubEnabled;

  useEffect(() => {
    if (
      optimisticClubEnabled !== null &&
      preferences !== undefined &&
      storedClubEnabled === optimisticClubEnabled
    ) {
      setOptimisticClubEnabled(null);
    }
  }, [optimisticClubEnabled, preferences, storedClubEnabled]);

  return (
    <div className="overflow-hidden rounded-xl bg-surface-2 shadow-surface-1">
      <div className="flex min-w-0 items-center justify-between gap-3 bg-surface-3 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Megaphone
            className={clubEnabled ? 'size-4 shrink-0 text-primary' : 'size-4 shrink-0 text-muted-foreground'}
            aria-hidden
          />
          <p className="truncate text-sm font-semibold text-foreground">{clubName}</p>
          <span className="shrink-0 text-xs tabular-nums text-muted-foreground" title="Visible channels">
            {channels.length}
          </span>
        </div>
        <NotificationScopeSwitch
          category="CLUB_ANNOUNCEMENT"
          label={`${clubName} notifications`}
          clubId={clubId}
          compact
          className="shrink-0"
          onOptimisticChange={setOptimisticClubEnabled}
        />
      </div>
      {channels.length > 0 ? (
        <div className="divide-y divide-border/60">
          {channels.map((channel) => {
            const channelScopeKey = `channel:${channel._id}`;
            const channelPreference = preferences?.find(
              (preference) =>
                preference.category === 'CLUB_CHANNEL_MENTION' &&
                preference.scopeKey === channelScopeKey,
            );
            const globalChannelPreference = preferences?.find(
              (preference) =>
                preference.category === 'CLUB_CHANNEL_MENTION' &&
                preference.scopeKey === 'global',
            );
            const storedChannelEnabled =
              (channelPreference ?? globalChannelPreference)?.enabled !== false;
            const channelEnabled =
              clubEnabled &&
              (optimisticChannelEnabled[channel._id] ?? storedChannelEnabled);

            return (
              <div
                key={channel._id}
                className="flex min-w-0 items-center justify-between gap-3 px-3 py-2 transition-colors hover:bg-hover"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <Hash
                    className={channelEnabled ? 'size-3.5 shrink-0 text-primary' : 'size-3.5 shrink-0 text-muted-foreground'}
                    aria-hidden
                  />
                  <p className="truncate text-sm font-medium">#{channel.name}</p>
                </div>
                <NotificationScopeSwitch
                  category="CLUB_CHANNEL_MENTION"
                  label={`${channel.name} mentions`}
                  clubId={clubId}
                  channelId={channel._id}
                  compact
                  className="shrink-0"
                  parentEnabled={clubEnabled}
                  onOptimisticChange={(enabled) => {
                    setOptimisticChannelEnabled((current) => {
                      if (enabled === null) {
                        const next = { ...current };
                        delete next[channel._id];
                        return next;
                      }
                      return { ...current, [channel._id]: enabled };
                    });
                  }}
                />
              </div>
            );
          })}
        </div>
      ) : (
        <p className="px-3 py-2 text-xs text-muted-foreground">No channels.</p>
      )}
    </div>
  );
}
