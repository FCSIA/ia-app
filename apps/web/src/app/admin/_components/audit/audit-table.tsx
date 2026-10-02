'use client';

import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminNotice } from '../admin-ui';
import { AUDIT_FETCH_LIMIT } from '../../_lib/admin-utils';
import type { AuditEventRecord } from '../../_lib/types';
import {
  auditActionLabel,
  auditRecordLabel,
  auditPersonName,
} from '~/apps/shared/audit';

type AuditTableProps = {
  isAuditLoading: boolean;
  displayedAuditEvents: AuditEventRecord[];
  auditEvents: AuditEventRecord[];
  auditStatus: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  hasActiveAuditFilters: boolean;
  onClearFilters: () => void;
  onInspect: (eventId: string) => void;
  onLoadMore: (numItems: number) => void;
};

export function AuditTable({
  isAuditLoading,
  displayedAuditEvents,
  auditStatus,
  hasActiveAuditFilters,
  onClearFilters,
  onInspect,
  onLoadMore,
}: AuditTableProps) {
  if (isAuditLoading) return <AdminNotice message="Loading activity…" />;
  const exhausted = auditStatus === 'Exhausted';
  const loadMore = !exhausted ? (
    <Button
      type="button"
      variant="tertiary"
      loading={auditStatus === 'LoadingMore'}
      disabled={auditStatus !== 'CanLoadMore'}
      onClick={() => onLoadMore(AUDIT_FETCH_LIMIT)}
    >
      {hasActiveAuditFilters ? 'Search older activity' : 'Load older activity'}
    </Button>
  ) : null;
  return (
    <div className="min-w-0 space-y-3">
      <div
        className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <p>
          {displayedAuditEvents.length}{' '}
          {hasActiveAuditFilters ? 'matching ' : ''}records loaded ·{' '}
          {exhausted ? 'End of history' : 'Newest first'}
        </p>
        {loadMore}
      </div>
      {!exhausted && hasActiveAuditFilters ? (
        <p className="text-xs text-muted-foreground">
          Search runs through history in batches. Continue searching older
          activity until the end of history to find every match.
        </p>
      ) : null}
      {displayedAuditEvents.length === 0 ? (
        <AdminNotice
          message={
            exhausted
              ? 'No activity matches this view.'
              : 'No matches in the activity checked so far. Search older activity to continue.'
          }
          actionLabel={hasActiveAuditFilters ? 'Clear filters' : undefined}
          onAction={hasActiveAuditFilters ? onClearFilters : undefined}
        />
      ) : (
        <ScrollArea orientation="horizontal" className="max-w-full">
          <Table className="table-fixed">
            <colgroup>
              <col className="hidden w-[140px] sm:table-column" />
              <col />
              <col className="w-[88px] sm:w-[100px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead className="hidden sm:table-cell">When</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>
                  <span className="sr-only">Record details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedAuditEvents.map((event, index) => {
                const meta = event.meta ?? {};
                const preview =
                  typeof meta.bodyPreview === 'string'
                    ? meta.bodyPreview
                    : null;
                return (
                  <TableRow key={event.id} index={index}>
                    <TableCell className="hidden align-top sm:table-cell">
                      <time dateTime={event.createdAt}>
                        {format(new Date(event.createdAt), 'MMM d, yyyy')}
                        <span className="block text-xs text-muted-foreground">
                          {format(new Date(event.createdAt), 'h:mm:ss a')}
                        </span>
                      </time>
                    </TableCell>
                    <TableCell className="align-top">
                      <div className="min-w-0 space-y-1 [overflow-wrap:anywhere]">
                        <p>
                          <span className="font-semibold">
                            {auditPersonName(event)}
                          </span>
                          <span className="block text-muted-foreground sm:inline">
                            {' '}
                            {auditActionLabel(event.action)}
                          </span>
                        </p>
                        <p className="text-sm">
                          {event.context?.title ??
                            auditRecordLabel(event.entityType)}
                        </p>
                        {event.context?.subtitle ? (
                          <p className="text-xs text-muted-foreground">
                            {event.context.subtitle}
                          </p>
                        ) : null}
                        {preview ? (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground">
                            {preview}
                          </p>
                        ) : null}
                        <p className="text-xs text-muted-foreground">
                          {auditRecordLabel(event.entityType)}
                          {event.entityId
                            ? ` · #${event.entityId.slice(0, 8)}`
                            : ''}
                        </p>
                        <time
                          className="block text-xs text-muted-foreground sm:hidden"
                          dateTime={event.createdAt}
                        >
                          {format(
                            new Date(event.createdAt),
                            'MMM d, yyyy · h:mm:ss a',
                          )}
                        </time>
                      </div>
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="tertiary"
                        aria-label={`Details: ${auditActionLabel(event.action)} by ${auditPersonName(event)}`}
                        onClick={() => onInspect(event.id)}
                      >
                        Details
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
      {displayedAuditEvents.length > 0 && loadMore ? (
        <div className="flex justify-center">{loadMore}</div>
      ) : null}
    </div>
  );
}
