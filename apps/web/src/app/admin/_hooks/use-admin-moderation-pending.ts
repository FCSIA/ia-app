'use client';

import { useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';

/** Badge count for the moderation tab — always subscribed, shared cache with the moderation tab. */
export function useAdminModerationPending() {
  const reports = useQuery(api.moderation.reports.list, {}) ?? [];

  return useMemo(
    () => reports.filter((r) => r.status === 'PENDING').length,
    [reports],
  );
}
