'use client';

import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Badge, type BadgeColor } from '@/components/ui/badge';
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
  auditActionSummary,
  auditRecordLabel,
  auditPersonName,
} from '~/apps/shared/audit';

type AuditTableProps = {
  isAuditLoading: boolean;
  displayedAuditEvents: AuditEventRecord[];
  auditStatus: 'LoadingFirstPage' | 'CanLoadMore' | 'LoadingMore' | 'Exhausted';
  hasActiveAuditFilters: boolean;
  onClearFilters: () => void;
  onInspect: (eventId: string) => void;
  onLoadMore: (numItems: number) => void;
};

const recordColors: Record<string, BadgeColor> = {
  Announcement: 'blue',
  Comment: 'violet',
  Message: 'violet',
  Channel: 'violet',
  Club: 'teal',
  'Club group': 'teal',
  'People group': 'teal',
  'Club join request': 'teal',
  'Student schedule': 'amber',
  'Schedule group': 'amber',
  'Schedule sharing link': 'amber',
  'Flex Friday': 'cyan',
  'Flex session': 'cyan',
  Workshop: 'cyan',
  'Workshop registration': 'cyan',
  'Workshop assignment': 'cyan',
  Attendance: 'cyan',
  Event: 'cyan',
  'Moderation keyword': 'red',
  Report: 'red',
  'Sign-in account': 'orange',
};

function AuditActivity({ event }: { event: AuditEventRecord }) {
  const type = auditRecordLabel(event.entityType);
  const title = event.context?.title;
  const hasTitle = !!title && title !== type;
  return (
    <div className="flex min-w-0 flex-col gap-1.5 [overflow-wrap:anywhere]">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
        {recordColors[type] ? (
          <Badge color={recordColors[type]} size="sm">
            {type}
          </Badge>
        ) : (
          <span className="line-clamp-2 min-w-0 max-w-full text-xs text-muted-foreground">
            {type}
          </span>
        )}
        <p className="max-w-full font-semibold text-foreground">
          {auditActionSummary(event.action, event.entityType)}
        </p>
      </div>
      {hasTitle ? (
        <p className="line-clamp-2 text-foreground">{title}</p>
      ) : event.entityId ? (
        <p className="text-xs text-muted-foreground">#{event.entityId.slice(0, 8)}</p>
      ) : null}
      {event.context?.subtitle ? (
        <p className="line-clamp-2 text-xs text-muted-foreground">{event.context.subtitle}</p>
      ) : null}
    </div>
  );
}

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
  return (
    <div className="min-w-0 space-y-3" aria-busy={auditStatus === 'LoadingMore'}>
      <p className="text-xs text-muted-foreground" role="status" aria-live="polite">
        {displayedAuditEvents.length} {hasActiveAuditFilters ? 'matching ' : ''}
        {displayedAuditEvents.length === 1 ? 'record' : 'records'} loaded
        {exhausted ? ' · End of history' : ' · Newest first'}
      </p>
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
          <Table className="table-fixed" aria-label="Audit activity">
            <colgroup>
              <col />
              <col className="hidden w-[160px] md:table-column xl:w-[200px]" />
              <col className="hidden w-[148px] sm:table-column" />
              <col className="w-[60px]" />
            </colgroup>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Activity</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">
                  Person
                </TableHead>
                <TableHead scope="col" className="hidden sm:table-cell">
                  When
                </TableHead>
                <TableHead scope="col">
                  <span className="sr-only">Details</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {displayedAuditEvents.map((event, index) => {
                const preview =
                  typeof event.meta?.bodyPreview === 'string' ? event.meta.bodyPreview : null;
                const person = auditPersonName(event);
                const action = auditActionLabel(event.action);
                const date = new Date(event.createdAt);
                return (
                  <TableRow key={event.id} index={index}>
                    <TableCell className="align-top">
                      <div className="flex min-w-0 flex-col gap-1.5 [overflow-wrap:anywhere]">
                        <AuditActivity event={event} />
                        {preview ? (
                          <p className="line-clamp-2 whitespace-pre-wrap text-xs text-muted-foreground">
                            {preview}
                          </p>
                        ) : null}
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground md:hidden">
                          <span className="line-clamp-2 max-w-full">{person}</span>
                          <time className="sm:hidden" dateTime={event.createdAt}>
                            {format(date, 'MMM d, yyyy')} ·{' '}
                            {format(date, 'h:mm:ss a')}
                          </time>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden align-top text-foreground [overflow-wrap:anywhere] md:table-cell">
                      <span className="line-clamp-2">{person}</span>
                    </TableCell>
                    <TableCell className="hidden align-top sm:table-cell">
                      <time dateTime={event.createdAt}>
                        {format(date, 'h:mm:ss a')}
                        <span className="block text-xs text-muted-foreground">
                          {format(date, 'MMM d, yyyy')}
                        </span>
                      </time>
                    </TableCell>
                    <TableCell className="align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={'Details: ' + action + ' by ' + person}
                        onClick={() => onInspect(event.id)}
                      >
                        <ChevronRight aria-hidden="true" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </ScrollArea>
      )}
      {!exhausted ? (
        <div className="flex flex-col items-center gap-2">
          <Button
            type="button"
            variant="tertiary"
            loading={auditStatus === 'LoadingMore'}
            disabled={auditStatus !== 'CanLoadMore'}
            onClick={() => onLoadMore(AUDIT_FETCH_LIMIT)}
          >
            {hasActiveAuditFilters ? 'Search older activity' : 'Load older activity'}
          </Button>
          {hasActiveAuditFilters ? (
            <p className="text-center text-xs text-muted-foreground">
              Search older activity until the end of history to find every match.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
