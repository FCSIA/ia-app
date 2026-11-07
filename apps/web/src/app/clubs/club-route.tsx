'use client';

import { createContext, useContext } from 'react';
import type { Id } from '~/apps/convex/src/_generated/dataModel';

const ClubIdContext = createContext<Id<'clubs'> | null>(null);

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
