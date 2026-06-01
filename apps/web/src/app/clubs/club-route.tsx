'use client';

import { createContext, useContext } from 'react';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

const ClubIdContext = createContext<Id<'clubs'> | null>(null);

/**
 * Parses the dynamic `/clubs/[clubId]` segment once. Child routes use `useClubId()`
 * so Convex queries get a typed `Id<"clubs">` without per-file cast helpers.
 */
export function ClubIdProvider({
  clubId,
  children,
}: {
  clubId: string;
  children: React.ReactNode;
}) {
  return (
    <ClubIdContext.Provider value={clubId as Id<'clubs'>}>{children}</ClubIdContext.Provider>
  );
}

export function useClubId(): Id<'clubs'> {
  const clubId = useContext(ClubIdContext);
  if (!clubId) {
    throw new Error('useClubId must be used within ClubIdProvider under /clubs/[clubId]');
  }
  return clubId;
}

/** Parses `/clubs/[clubId]/channels/[channelId]` once per page. */
export function useRouteChannelId(channelId: string): Id<'clubChannels'> {
  return channelId as Id<'clubChannels'>;
}
