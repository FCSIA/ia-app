'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { moderationApi } from '@/lib/api';

/** Badge count for the moderation tab — always subscribed, shared cache with the moderation tab. */
export function useAdminModerationPending() {
  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => moderationApi.getReports().then((r) => r.data),
    staleTime: 60_000,
  });

  return useMemo(
    () => (reports as Array<{ status?: string }>).filter((r) => r.status === 'PENDING').length,
    [reports],
  );
}
