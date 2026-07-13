'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import { Panel } from '@/components/layout/page-frame';
import { PushNotificationSettings } from '@/components/notifications/push-notification-settings';
import { NotificationScopeSwitch } from '@/components/notifications/notification-scope-switch';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

export function NotificationSettingsPanel() {
  const preferences = useQuery(api.notifications.preferences.list) ?? [];
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
    <Panel contentClassName="flex flex-col gap-5 p-5">
      <PushNotificationSettings />
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Global</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ['SCHOOL_ANNOUNCEMENT', 'School announcements'],
            ['EVENT', 'Events'],
            ['FLEX_FRIDAY', 'Flex Friday'],
            ['FRIEND_REQUEST', 'Friend schedules'],
            ['CONTENT_MODERATED', 'Moderation notices'],
          ].map(([category, label]) => (
            <NotificationScopeSwitch key={category} category={category as any} label={label} />
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Clubs and channels</h2>
        {clubsLoading ? (
          <p className="text-sm text-muted-foreground">Loading club notification settings…</p>
        ) : involvedClubs.length > 0 ? (
          <div className="grid gap-3">
            {involvedClubs.map((club) => (
              <ClubNotificationChannels key={club._id} clubId={club._id} clubName={club.name} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Join or sponsor clubs to configure club-specific notifications.
          </p>
        )}
      </section>
      <p className="text-xs text-muted-foreground">
        {preferences.length} saved preference{preferences.length === 1 ? '' : 's'}.
      </p>
    </Panel>
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
    <div className="rounded-lg border p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="font-medium">{clubName}</p>
        <NotificationScopeSwitch
          category="CLUB_ANNOUNCEMENT"
          label="Announcements"
          clubId={clubId}
          compact
        />
      </div>
      {channels.length > 0 ? (
        <div className="grid gap-2">
          {channels.map((channel) => (
            <div
              key={channel._id}
              className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-muted/30 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">#{channel.name}</p>
                <p className="truncate text-xs text-muted-foreground">Channel mentions</p>
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
        <p className="text-xs text-muted-foreground">No visible channels to configure yet.</p>
      )}
    </div>
  );
}
