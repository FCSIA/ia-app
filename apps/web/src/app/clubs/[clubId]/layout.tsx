'use client';

import { use } from 'react';
import { ClubIdProvider } from '../club-route';

export default function ClubLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = use(params);
  return <ClubIdProvider clubId={clubId}>{children}</ClubIdProvider>;
}
