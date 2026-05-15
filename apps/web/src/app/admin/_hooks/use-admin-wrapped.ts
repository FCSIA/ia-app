'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { wrappedApi, type WrappedSnapshotStatus } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { refreshWrappedResultTitle, schoolYearLabel } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';

export function useAdminWrapped(activeTab: AdminTabId, canManageWrapped: boolean) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const currentWrappedSchoolYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  }, []);

  const [wrappedSchoolYear, setWrappedSchoolYear] = useState(currentWrappedSchoolYear);
  const wrappedYearOptions = Array.from({ length: 5 }, (_, index) => currentWrappedSchoolYear - index);

  const {
    data: wrappedSnapshotStatus,
    isLoading: isWrappedStatusLoading,
    isError: isWrappedStatusError,
    error: wrappedStatusError,
  } = useQuery<WrappedSnapshotStatus>({
    queryKey: ['wrapped', 'admin', 'snapshots', wrappedSchoolYear],
    queryFn: () => wrappedApi.getSnapshotStatus(wrappedSchoolYear).then((r) => r.data),
    enabled: activeTab === 'wrapped' && canManageWrapped,
  });

  const generateWrappedSnapshotsMutation = useMutation({
    mutationFn: (refresh: boolean) =>
      wrappedApi.generateSnapshots({ schoolYear: wrappedSchoolYear, refresh }).then((r) => r.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['wrapped', 'admin', 'snapshots', wrappedSchoolYear] });
      toast({
        title: refreshWrappedResultTitle(result.generated, result.skipped),
        description: `${result.requested} eligible students checked for ${schoolYearLabel(result.schoolYear)}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: err.response?.data?.message || err.message || 'Wrapped snapshot run failed',
        variant: 'destructive',
      });
    },
  });

  return {
    wrappedSchoolYear,
    setWrappedSchoolYear,
    wrappedYearOptions,
    status: wrappedSnapshotStatus,
    isLoading: isWrappedStatusLoading,
    isError: isWrappedStatusError,
    error: wrappedStatusError,
    generateMutation: generateWrappedSnapshotsMutation,
  };
}
