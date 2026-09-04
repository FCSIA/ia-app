'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import type { FunctionReturnType } from 'convex/server';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { refreshWrappedResultTitle, schoolYearLabel } from '../_lib/admin-utils';
import type { AdminTabId } from './use-admin-tab';

export type WrappedSnapshotStatus = FunctionReturnType<
  typeof api.wrapped.snapshots.snapshotStatus
>;

export function useAdminWrapped(activeTab: AdminTabId, canManageWrapped: boolean) {
  const { toast } = useToast();

  const currentWrappedSchoolYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  }, []);

  const [wrappedSchoolYear, setWrappedSchoolYear] = useState(currentWrappedSchoolYear);
  const wrappedYearOptions = Array.from({ length: 5 }, (_, index) => currentWrappedSchoolYear - index);

  const wrappedSnapshotStatus = useQuery(
    api.wrapped.snapshots.snapshotStatus,
    activeTab === 'wrapped' && canManageWrapped ? { schoolYear: wrappedSchoolYear } : 'skip',
  );

  const runGenerateSnapshots = useMutation(api.wrapped.snapshots.generateSnapshots);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateMutation = {
    isPending: isGenerating,
    mutate: (refresh: boolean) => {
      setIsGenerating(true);
      void runGenerateSnapshots({
        schoolYear: wrappedSchoolYear,
        refresh,
      })
        .then((result) => {
          toast({
            title: result.queued
              ? 'Wrapped snapshot run queued'
              : refreshWrappedResultTitle(result.generated, result.skipped),
            description: result.queued
              ? `Every eligible student will be processed in the background for ${schoolYearLabel(result.schoolYear)}.`
              : `${result.requested} eligible students checked for ${schoolYearLabel(result.schoolYear)}.`,
          });
        })
        .catch((err: Error) => {
          toast({
            title: err.message || 'Wrapped snapshot run failed',
            variant: 'destructive',
          });
        })
        .finally(() => setIsGenerating(false));
    },
  };

  return {
    wrappedSchoolYear,
    setWrappedSchoolYear,
    wrappedYearOptions,
    status: wrappedSnapshotStatus,
    isLoading: wrappedSnapshotStatus === undefined && activeTab === 'wrapped' && canManageWrapped,
    isError: false,
    error: null,
    generateMutation,
  };
}
