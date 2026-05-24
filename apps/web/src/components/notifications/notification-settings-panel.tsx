'use client';

import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { clubsApi, notificationsApi } from '@/lib/api';
import { Panel } from '@/components/layout/page-frame';
import { NotificationScopeSwitch } from '@/components/notifications/notification-scope-switch';

export function NotificationSettingsPanel() {
  const { data: preferences = [] } = useQuery<any[]>({
    queryKey: ['notification-preferences'],
    queryFn: () => notificationsApi.getPreferences().then((r) => r.data),
    staleTime: 60_000,
  });

  const { data: myClubs, isLoading: clubsLoading } = useQuery<any>({
    queryKey: ['my-clubs'],
    queryFn: () => clubsApi.getMyClubs().then((r) => r.data),
    staleTime: 60_000,
  });

  const involvedClubs = useMemo(() => {
    const entries = [...(myClubs?.memberOf ?? []), ...(myClubs?.sponsoring ?? [])];
    const seen = new Set<string>();
    return entries.filter((club: any) => {
      if (seen.has(club.id)) return false;
      seen.add(club.id);
      return true;
    });
  }, [myClubs]);

  const channelQueries = useQueries({
    queries: involvedClubs.map((club: any) => ({
      queryKey: ['club-channels', club.id],
      queryFn: () => clubsApi.getChannels(club.id).then((r) => r.data),
      enabled: !!club.id,
      staleTime: 60_000,
    })),
  });

  const channelsByClub = useMemo(() => {
    const next = new Map<string, any[]>();
    involvedClubs.forEach((club: any, index) => {
      next.set(club.id, (channelQueries[index]?.data as any[]) ?? []);
    });
    return next;
  }, [channelQueries, involvedClubs]);

  const channelsLoading = channelQueries.some((query) => query.isLoading);

  return (
    <Panel contentClassName="flex flex-col gap-5 p-5">
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
            <NotificationScopeSwitch key={category} category={category} label={label} />
          ))}
          <NotificationScopeSwitch
            category="SCHOOL_ANNOUNCEMENT"
            label="Push notifications to everyone"
            scopeKey="admin-push"
            locked
          />
        </div>
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold">Clubs and channels</h2>
        {clubsLoading || channelsLoading ? (
          <p className="text-sm text-muted-foreground">Loading club notification settings…</p>
        ) : involvedClubs.length > 0 ? (
          <div className="grid gap-3">
            {involvedClubs.map((club: any) => {
              const channels = channelsByClub.get(club.id) ?? [];
              return (
                <div key={club.id} className="rounded-lg border p-3">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="font-medium">{club.name}</p>
                    <NotificationScopeSwitch
                      category="CLUB_ANNOUNCEMENT"
                      label="Announcements"
                      clubId={club.id}
                      compact
                    />
                  </div>
                  {channels.length > 0 ? (
                    <div className="grid gap-2">
                      {channels.map((channel: any) => (
                        <div
                          key={channel.id}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-2xl bg-muted/30 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">#{channel.name}</p>
                            <p className="truncate text-xs text-muted-foreground">Channel mentions</p>
                          </div>
                          <NotificationScopeSwitch
                            category="CLUB_CHANNEL_MENTION"
                            label={`${channel.name} mentions`}
                            clubId={club.id}
                            channelId={channel.id}
                            compact
                            className="shrink-0"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      No visible channels to configure yet.
                    </p>
                  )}
                </div>
              );
            })}
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
