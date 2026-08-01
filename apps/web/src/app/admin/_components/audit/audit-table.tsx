'use client';

import { format } from 'date-fns';
import { Eye } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { dataTableClasses } from '@/components/data/data-table-panel';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AdminNotice } from '../admin-ui';
import { AUDIT_FETCH_LIMIT } from '../../_lib/admin-utils';
import type { AuditEventRecord } from '../../_lib/types';

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
  auditEvents,
  auditStatus,
  hasActiveAuditFilters,
  onClearFilters,
  onInspect,
  onLoadMore,
}: AuditTableProps) {
  const d = dataTableClasses('compact');
  const headers = ['Time', 'Actor', 'Action', 'Entity', 'Inspect'];

  if (isAuditLoading) {
    return <AdminNotice message="Loading audit events..." />;
  }

  if (displayedAuditEvents.length === 0) {
    return (
      <AdminNotice
        message={hasActiveAuditFilters ? 'No audit events match these filters.' : 'No audit events.'}
        actionLabel={hasActiveAuditFilters ? 'Clear filters' : undefined}
        onAction={hasActiveAuditFilters ? onClearFilters : undefined}
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {displayedAuditEvents.length} matching event{displayedAuditEvents.length === 1 ? '' : 's'}
          {auditEvents.length > displayedAuditEvents.length ? ` from ${auditEvents.length} loaded` : ''}
        </span>
        {auditStatus !== 'Exhausted' ? (
          <Button
            type="button"
            variant="tertiary"
            size="sm"
            loading={auditStatus === 'LoadingMore'}
            disabled={auditStatus !== 'CanLoadMore'}
            onClick={() => onLoadMore(AUDIT_FETCH_LIMIT)}
          >
            Load more
          </Button>
        ) : null}
      </div>

      <div className="overflow-auto rounded-lg border">
        <Table className={`${d.table} table-fixed`}>
          <colgroup>
            <col className="w-[152px]" />
            <col className="w-[180px]" />
            <col className="w-[190px]" />
            <col />
            <col className="w-[104px]" />
          </colgroup>
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header} className={d.head}>
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {displayedAuditEvents.map((event, index) => {
              const meta = event.meta ?? {};
              const contextHint =
                (typeof meta.clubName === 'string' && typeof meta.channelName === 'string'
                  ? `${meta.clubName} · #${meta.channelName}`
                  : typeof meta.title === 'string'
                    ? meta.title
                    : typeof meta.name === 'string'
                      ? meta.name
                      : typeof meta.bodyPreview === 'string'
                        ? meta.bodyPreview
                        : null) ?? null;

              return (
                <TableRow key={event.id} index={index} className="h-11">
                  <TableCell className={`${d.cell} whitespace-nowrap align-top font-mono text-[11px]`}>
                    {format(new Date(event.createdAt), 'MMM d, yyyy')}
                    <div className="mt-1 text-muted-foreground">{format(new Date(event.createdAt), 'h:mm:ss a')}</div>
                  </TableCell>
                  <TableCell className={`${d.cell} min-w-0 align-top`}>
                    <div className="truncate font-medium text-foreground">
                      {event.actor ? `${event.actor.firstName} ${event.actor.lastName}` : 'System'}
                    </div>
                  </TableCell>
                  <TableCell className={`${d.cell} min-w-0 align-top`}>
                    <Badge variant="dot" size="sm" className="max-w-full font-mono text-[11px]">
                      <span className="truncate">{event.action}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className={`${d.cell} min-w-0 align-top`}>
                    <div className="truncate font-medium text-foreground">
                      {event.entityType}
                      {event.entityId ? ` #${event.entityId.slice(0, 8)}` : ''}
                    </div>
                    {contextHint ? (
                      <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                        {contextHint}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell className={`${d.cell} align-top`}>
                    <Button
                      type="button"
                      size="sm"
                      variant="tertiary"
                      leadingIcon={Eye}
                      onClick={() => onInspect(event.id)}
                    >
                      Inspect
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
