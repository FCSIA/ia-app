'use client';

import Link from 'next/link';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { WrappedSnapshotStatus } from '../_hooks/use-admin-wrapped';
import { formatDateTime, schoolYearLabel } from '../_lib/admin-utils';
import { AdminNotice, AdminPanel } from './admin-ui';

export function WrappedSnapshotsTab({
  wrappedSchoolYear,
  onWrappedSchoolYearChange,
  wrappedYearOptions,
  status,
  isLoading,
  isError,
  error,
  generateMutation,
}: {
  wrappedSchoolYear: number;
  onWrappedSchoolYearChange: (schoolYear: number) => void;
  wrappedYearOptions: number[];
  status?: WrappedSnapshotStatus;
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  generateMutation: { isPending: boolean; mutate: (refresh: boolean) => void };
}) {
  const canGenerate = !!status && status.eligibleUsers > 0 && !isLoading && !isError && !generateMutation.isPending;
  const actions = (
    <>
      <Select
        value={String(wrappedSchoolYear)}
        disabled={generateMutation.isPending}
        onValueChange={(value) => onWrappedSchoolYearChange(Number(value))}
      >
        <SelectTrigger aria-label="School year" className="w-full sm:w-[150px]" placeholder="School year" />
        <SelectContent>
          {wrappedYearOptions.map((year, index) => (
            <SelectItem key={year} index={index} value={String(year)}>
              {schoolYearLabel(year)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant="secondary"
        leadingIcon={Sparkles}
        disabled={!canGenerate || status?.missing === 0}
        onClick={() => generateMutation.mutate(false)}
      >
        Generate missing
      </Button>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="tertiary" leadingIcon={RefreshCw} disabled={!canGenerate} loading={generateMutation.isPending}>
            Refresh all
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Refresh {schoolYearLabel(wrappedSchoolYear)} snapshots?</AlertDialogTitle>
            <AlertDialogDescription>
              Rebuild snapshots for all {status?.eligibleUsers ?? 0} eligible students, including {status?.generated ?? 0} already generated. Existing snapshots will be replaced. This cannot be undone here.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => generateMutation.mutate(true)}>Refresh all snapshots</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return (
    <div>
      <AdminPanel title="Wrapped snapshots" actions={actions} contentClassName="space-y-5">
          {isLoading ? (
            <AdminNotice message="Loading Wrapped snapshot status..." />
          ) : isError ? (
            <AdminNotice
              tone="danger"
              title="Could not load Wrapped snapshot status."
              message={error instanceof Error ? error.message : 'Request failed.'}
            />
          ) : status ? (
            <>
              <div className="flex flex-col gap-4 py-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {status.eligibleUsers === 0 ? 'No eligible students for this school year.' : `${status.generated} of ${status.eligibleUsers} student snapshots generated`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {status.missing} missing · {status.stale} need a schema refresh
                  </p>
                  <p className="mt-3 text-xs text-muted-foreground">
                    Latest generation: {formatDateTime(status.latestGeneratedAt)} · Schema v{status.schemaVersion}
                  </p>
                </div>
                <Link href="/wrapped" className="text-sm font-medium text-primary hover:underline">
                  Preview Wrapped
                </Link>
              </div>
            </>
          ) : null}
      </AdminPanel>
    </div>
  );
}
