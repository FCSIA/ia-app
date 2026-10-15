'use client';

import { use } from 'react';
import { ClubPresenceProvider } from '@/components/presence/club-presence';
import { ClubIdProvider } from '../club-route';

export default function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  return (
    <ClubIdProvider clubId={clubId}>
      <ClubPresenceProvider clubId={clubId}>{children}</ClubPresenceProvider>
    </ClubIdProvider>
  );
}
