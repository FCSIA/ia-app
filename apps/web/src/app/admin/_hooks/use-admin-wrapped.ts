'use client';

import { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { useToast } from '@/hooks/use-toast';
import { schoolYearLabel, schoolYearStart } from '~/apps/shared/school-time';
import { refreshWrappedResultTitle } from '../_lib/admin-utils';

export function useAdminWrapped() {
  const { toast } = useToast();

  const currentWrappedSchoolYear = useMemo(() => schoolYearStart(new Date()), []);

  const [wrappedSchoolYear, setWrappedSchoolYear] = useState(currentWrappedSchoolYear);
  const wrappedYearOptions = Array.from({ length: 5 }, (_, index) => currentWrappedSchoolYear - index);

  const wrappedSnapshotStatus = useQuery(
    api.wrapped.snapshots.snapshotStatus,
    { schoolYear: wrappedSchoolYear },
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
    isLoading: wrappedSnapshotStatus === undefined,
    generateMutation,
  };
}
