'use client';

import Link from 'next/link';
import { RefreshCw, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import type { WrappedSnapshotStatus } from '../_hooks/use-admin-wrapped';
import { cn } from '@/lib/utils';
import { formatDateTime, schoolYearLabel } from '../_lib/admin-utils';

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="border-b pb-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <CardTitle className="text-base">Wrapped Snapshots</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={String(wrappedSchoolYear)}
                onValueChange={(value) => onWrappedSchoolYearChange(Number(value))}
              >
                <SelectTrigger className="w-[150px]" placeholder="School year" />
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
                Generate Missing
              </Button>
              <Button
                type="button"
                variant="tertiary"
                disabled={generateMutation.isPending}
                onClick={() => {
                  if (!confirm(`Refresh every ${schoolYearLabel(wrappedSchoolYear)} Wrapped snapshot?`)) return;
                  generateMutation.mutate(true);
                }}
              >
                <RefreshCw size={15} className={cn('mr-1.5', generateMutation.isPending && 'animate-spin')} />
                Refresh All
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 pt-6">
          {isLoading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Loading Wrapped snapshot status...</p>
          ) : isError ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <p className="text-sm font-medium text-destructive">Could not load Wrapped snapshot status.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {(error as any)?.response?.data?.message || (error as Error)?.message || 'Request failed.'}
              </p>
            </div>
          ) : status ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <SnapshotMetric label="Coverage" value={`${coveragePercent}%`} detail={`${status.generated} of ${status.eligibleUsers} eligible students`} />
                <SnapshotMetric label="Missing" value={String(status.missing)} detail="Generate missing to fill these snapshots." />
                <SnapshotMetric label="Stale" value={String(status.stale)} detail={`Schema v${status.schemaVersion} is current.`} />
                <SnapshotMetric label="Freshness" value={formatDateTime(status.latestGeneratedAt)} detail="Latest generated snapshot" compact />
              </div>

              <div className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
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
        </CardContent>
      </Card>
    </div>
  );
}

function SnapshotMetric({
  label,
  value,
  detail,
  compact,
}: {
  label: string;
  value: string;
  detail: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-muted/20 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn('mt-2 font-semibold text-foreground', compact ? 'text-sm' : 'text-3xl')}>{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

