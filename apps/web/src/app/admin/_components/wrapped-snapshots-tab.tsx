'use client';

import Link from 'next/link';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { WrappedSnapshotStatus } from '../_hooks/use-admin-wrapped';
import { formatDateTime, schoolYearLabel } from '../_lib/admin-utils';
import { AdminMetric, AdminNotice, AdminPanel } from './admin-ui';

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
  const coveragePercent = status?.eligibleUsers
    ? Math.round((status.generated / status.eligibleUsers) * 100)
    : 0;
  const isCurrent = !!status && status.missing === 0 && status.stale === 0;
  const actions = (
    <>
      <Select
        value={String(wrappedSchoolYear)}
        onValueChange={(value) => onWrappedSchoolYearChange(Number(value))}
      >
        <SelectTrigger className="w-full sm:w-[150px]" placeholder="School year" />
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
        disabled={generateMutation.isPending}
        onClick={() => generateMutation.mutate(false)}
      >
        Generate missing
      </Button>
      <Button
        type="button"
        variant="tertiary"
        leadingIcon={RefreshCw}
        loading={generateMutation.isPending}
        onClick={() => {
          if (!confirm(`Refresh every ${schoolYearLabel(wrappedSchoolYear)} Wrapped snapshot?`)) return;
          generateMutation.mutate(true);
        }}
      >
        Refresh all
      </Button>
    </>
  );

  return (
    <div>
      <AdminPanel title="Wrapped Snapshots" actions={actions} contentClassName="space-y-5">
          {isLoading ? (
            <AdminNotice message="Loading Wrapped snapshot status..." />
          ) : isError ? (
            <AdminNotice
              tone="danger"
              title="Could not load Wrapped snapshot status."
              message={(error as any)?.response?.data?.message || (error as Error)?.message || 'Request failed.'}
            />
          ) : status ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <AdminMetric label="Coverage" value={`${coveragePercent}%`} detail={`${status.generated} of ${status.eligibleUsers} eligible students`} />
                <AdminMetric label="Missing" value={status.missing} detail="Generate missing to fill these snapshots." />
                <AdminMetric label="Stale" value={status.stale} detail={`Schema v${status.schemaVersion} is current.`} />
                <AdminMetric label="Freshness" value={formatDateTime(status.latestGeneratedAt)} detail="Latest generated snapshot" compact />
              </div>

              <div className="flex flex-col gap-3 rounded-lg border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">
                      {schoolYearLabel(status.schoolYear)} launch readiness
                    </p>
                    <Badge variant={isCurrent ? 'solid' : 'dot'} color={isCurrent ? 'green' : 'amber'}>
                      {isCurrent ? 'Current' : 'Needs attention'}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Generate missing skips current snapshots. Refresh all rebuilds every eligible student for the selected school year.
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
