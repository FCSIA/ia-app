'use client';

import { Component, type ReactNode } from 'react';
import Link from 'next/link';
import { useQuery } from '@/lib/convex-react';
import { Button } from '@/components/ui/button';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

import { selectUnreadChannels } from './unread-channel-selection';

class UnreadErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed ? (
      <p role="alert">Unread channels could not be loaded. <Button variant="ghost" size="sm" onClick={() => this.setState({ failed: false })}>Retry</Button></p>
    ) : this.props.children;
  }
}

function UnreadChannelList({ clubId }: { clubId: Id<'clubs'> }) {
  const navigation = useQuery(api.clubs.detail.getWorkspaceNavigation, { clubId });
  const activity = useQuery(api.clubs.detail.getWorkspaceActivity, { clubId });
  if (navigation === undefined || activity === undefined) return <p role="status">Loading unread channels…</p>;
  if (!navigation || !activity) return <p role="status">Channel activity is unavailable.</p>;
  const channels = selectUnreadChannels(navigation.channels, activity.channels);
  if (!channels.length) return <p role="status" className="text-sm text-muted-foreground">No unread channels.</p>;
  return (
    <ul className="flex flex-wrap gap-2">
      {channels.map((channel) => (
        <li key={channel._id}>
          <Button asChild variant="ghost" size="sm">
            <Link href={`/clubs/${clubId}/channels/${channel._id}`}>#{channel.name}<span className="sr-only"> — unread messages</span></Link>
          </Button>
        </li>
      ))}
    </ul>
  );
}

export function UnreadChannels({ clubId }: { clubId: Id<'clubs'> }) {
  return (
    <section aria-labelledby="unread-channels-title" className="space-y-2">
      <h2 id="unread-channels-title" className="text-base font-semibold">Unread channels</h2>
      <UnreadErrorBoundary key={clubId}><UnreadChannelList clubId={clubId} /></UnreadErrorBoundary>
    </section>
  );
}
