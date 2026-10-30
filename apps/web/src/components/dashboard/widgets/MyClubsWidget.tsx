'use client';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { Panel } from '@/components/layout/page-frame';
import { CardGroup } from '@/components/ui/card';
import { ClubListRow } from '@/components/clubs/club-list-row';
import { Empty, EmptyDescription } from '@/components/ui/empty';
export function MyClubsWidget() {
  const data = useQuery(api.clubs.management.getMyClubs, {
    includeActivity: true,
  });
  return (
    <Panel
      title="My clubs"
      href="/clubs"
      count={data?.clubs.length}
      loading={!data}
      flush
    >
      {data?.clubs.length ? (
        <CardGroup orientation="inline" corners="compact">
          {data.clubs.slice(0, 3).map((club) => (
            <ClubListRow
              key={club._id}
              club={club}
              density="compact"
              meta={
                club.unreadChannels
                  ? `${club.unreadChannels}${club.unreadHasMore ? '+' : ''} unread ${club.unreadChannels === 1 && !club.unreadHasMore ? 'channel' : 'channels'}`
                  : club.unreadHasMore
                    ? 'Open club'
                    : 'No unread channels'
              }
            />
          ))}
        </CardGroup>
      ) : (
        <Empty size="inline">
          <EmptyDescription>
            You haven&apos;t joined any clubs.{' '}
            <a href="/clubs/discover">Browse clubs</a>
          </EmptyDescription>
        </Empty>
      )}
    </Panel>
  );
}
