'use client';

import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { useQuery } from '@/lib/convex-react';

/** `undefined` while loading; `null` when the club is missing or inactive. */
export function useClubDetail(clubId: Id<'clubs'>) {
  return useQuery(api.clubs.detail.get, { clubId });
}
