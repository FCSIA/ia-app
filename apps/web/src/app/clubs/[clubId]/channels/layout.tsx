'use client';

import type { ReactNode } from 'react';
import { ChannelWorkspace } from './channel-workspace';

/**
 * Keep the club workspace mounted when the selected `[channelId]` changes.
 * The leaf page remains a URL/deep-link boundary; its content is owned by this
 * stable layout so sidebar state, panel sizes, and the composer do not reset.
 */
export default function ClubChannelsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ChannelWorkspace />
      {children}
    </>
  );
}
