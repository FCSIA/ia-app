'use client';

import Link from 'next/link';
import { Fragment, createContext, useContext, useMemo, useState } from 'react';
import type { Column, Table } from '@tanstack/react-table';
import {
  useDataTable,
  DataTable,
  DataTableColumnHeader,
  DataTableColumnHeaderLabel,
  DataTableControls,
  DataTablePagination,
  type ColumnDef,
} from '@/components/ui/data-table';
import { format } from 'date-fns';
import {
  CalendarDays,
  ListFilter,
  FileText,
  Megaphone,
  MessagesSquare,
  Shield,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownTrigger } from '@/components/ui/dropdown';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@/components/ui/popover';
import {
  AuditColumnFilter,
  WhenRangeFields,
  auditFilterActive,
  type AuditFilterColumn,
} from './audit-filters';
import { AUDIT_FETCH_LIMIT } from '../../_lib/admin-utils';
import type { AuditEventRecord } from '../../_lib/types';
import type { useAdminAudit } from '../../_hooks/use-admin-audit';
import {
  AUDIT_CATEGORIES,
  auditActionInfo,
  auditActionLabel,
  auditCategory,
  auditPersonName,
  auditRecordTitle,
} from '~/apps/shared/audit';
import { AuditPerson } from './audit-person';

type AuditState = ReturnType<typeof useAdminAudit>;
const AuditTableContext = createContext<AuditState | null>(null);
const icons = {
  'people-access': Users,
  'clubs-chat': MessagesSquare,
  announcements: Megaphone,
  moderation: Shield,
  schedules: FileText,
  'flex-events': CalendarDays,
};
/** Where a record lives (club, then channel, workshop, …); people are not places. */
const PLACE_LABELS = new Set([
  'Club',
  'Channel',
  'Workshop',
  'Session',
  'Board',
  'Announcement',
  'Event',
  'Unit',
  'Group',
  'Template',
  'Course',
]);
function auditPlaces(event: AuditEventRecord) {
  return (event.context?.links ?? [])
    .filter(
      (link) => link.id !== event.entityId && PLACE_LABELS.has(link.label),
    )
    .slice(0, 2);
}
function RecordCell({ event }: { event: AuditEventRecord }) {
  const title = auditRecordTitle(event);
  const href = event.context?.links?.find(
    (link) => link.id === event.entityId,
  )?.href;
  if (href)
    return (
      <Link
        className="block truncate text-foreground hover:underline focus-visible:underline"
        href={href}
        title={title}
      >
        {title}
      </Link>
    );
  if (!event.context?.deleted)
    return (
      <span className="block truncate text-foreground" title={title}>
        {title}
      </span>
    );
  // The action already says so for deletions; elsewhere the state needs words, not only a muted color.
  const stated = /^(Deleted|Removed)\b/.test(auditActionLabel(event.action));
  return (
    <span
      className="flex min-w-0 gap-1 text-muted-foreground"
      title={`${title} (deleted)`}
    >
      <span className="truncate">{title}</span>
      {stated ? null : <span className="shrink-0">(deleted)</span>}
    </span>
  );
}
function WhereCell({ event }: { event: AuditEventRecord }) {
  const places = auditPlaces(event);
  if (!places.length)
    return (
      <span className="block truncate">{event.context?.subtitle || '—'}</span>
    );
  // The innermost place (the channel) is the most specific, so the club truncates first.
  return (
    <span className="flex min-w-0 items-center gap-1">
      {places.map((place, index) => {
        const name = place.label === 'Channel' ? `#${place.name}` : place.name;
        const fit =
          index && index === places.length - 1
            ? 'max-w-full shrink-0 truncate'
            : 'min-w-0 truncate';
        return (
          <Fragment key={`${place.label}:${place.id}`}>
            {index ? <span aria-hidden="true">·</span> : null}
            {place.href ? (
              <Link
                href={place.href}
                className={`${fit} hover:underline focus-visible:underline`}
                title={`${place.label}: ${place.name}`}
              >
                {name}
              </Link>
            ) : (
              <span className={fit}>{name}</span>
            )}
          </Fragment>
        );
      })}
    </span>
  );
}
function Action({ event }: { event: AuditEventRecord }) {
  const category = auditCategory(event.entityType, event.action);
  const Icon = icons[category];
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Icon
        size={14}
        className="shrink-0 text-muted-foreground"
        aria-label={AUDIT_CATEGORIES[category]}
      />
      <span
        className={`truncate ${auditActionInfo(event.action)?.destructive ? 'text-destructive' : 'text-foreground'}`}
      >
        {auditActionLabel(event.action)}
      </span>
    </span>
  );
}
function AuditPersonCell({ event }: { event: AuditEventRecord }) {
  const audit = useContext(AuditTableContext);
  if (!audit) throw new Error('AuditPersonCell requires AuditTableContext');
  return <AuditPerson event={event} onFilter={audit.setAuditActorId} />;
}

/** Feature filters use ColumnDef.header; Fluid retains ownership of sorting and controls. */
function AuditColumnHeader({
  title,
  column,
}: {
  column: Column<AuditEventRecord, unknown>;
  title: AuditFilterColumn;
}) {
  const audit = useContext(AuditTableContext);
  if (!audit) throw new Error('AuditColumnHeader requires AuditTableContext');
  const [menuOpen, setMenuOpen] = useState(false);
  const [rangeOpen, setRangeOpen] = useState(false);
  return (
    <Popover open={rangeOpen} onOpenChange={setRangeOpen}>
      <PopoverAnchor asChild>
        <div>
          <DataTableColumnHeader column={column} title={title}>
          <DataTableColumnHeaderLabel />
          <DataTableControls>
          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-compact"
                  active={auditFilterActive(audit, title)}
                  aria-label={`Filter ${title.toLowerCase()}`}
                >
                  <ListFilter />
                </Button>
              }
            />
            <AuditColumnFilter
              column={title}
              surface="menu"
              audit={audit}
              onCustomRange={() => {
                setMenuOpen(false);
                setRangeOpen(true);
              }}
            />
          </DropdownMenu>
          </DataTableControls>
          </DataTableColumnHeader>
        </div>
      </PopoverAnchor>
      {title === 'When' ? (
        <PopoverContent align="start" aria-label="Custom date range">
          <WhenRangeFields audit={audit} />
        </PopoverContent>
      ) : null}
    </Popover>
  );
}

export function useAuditDataTable(audit: AuditState) {
  const columns = useMemo<ColumnDef<AuditEventRecord>[]>(
    () => [
      {
        accessorKey: 'createdAt',
        header: ({ column }) => <AuditColumnHeader column={column} title="When" />,
        meta: { label: 'When' },
        cell: ({ row }) => (
          <time
            className="whitespace-nowrap"
            dateTime={row.original.createdAt}
            title={format(new Date(row.original.createdAt), 'PPpp')}
          >
            {format(new Date(row.original.createdAt), 'MMM d, h:mm a')}
          </time>
        ),
      },
      {
        id: 'person',
        accessorFn: auditPersonName,
        header: ({ column }) => <AuditColumnHeader column={column} title="Person" />,
        meta: { label: 'Person' },
        cell: ({ row }) => (
          <AuditPersonCell event={row.original} />
        ),
      },
      {
        id: 'action',
        accessorFn: (event) => auditActionLabel(event.action),
        header: ({ column }) => <AuditColumnHeader column={column} title="Action" />,
        meta: { label: 'Action' },
        cell: ({ row }) => <Action event={row.original} />,
      },
      {
        id: 'record',
        accessorFn: auditRecordTitle,
        header: ({ column }) => <AuditColumnHeader column={column} title="Record" />,
        meta: { label: 'Record' },
        cell: ({ row }) => <RecordCell event={row.original} />,
      },
      {
        id: 'where',
        accessorFn: (event) =>
          auditPlaces(event)
            .map((place) => place.name)
            .join(' · ') ||
          event.context?.subtitle ||
          '',
        header: 'Where',
        cell: ({ row }) => <WhereCell event={row.original} />,
      },
    ],
    [],
  );
  return useDataTable<AuditEventRecord>({
    data: audit.displayedAuditEvents,
    columns,
    pageSize: 20,
    getRowId: (event) => event.id,
    manualFiltering: true,
    enableSorting: false,
    state: { globalFilter: audit.auditSearch },
    onGlobalFilterChange: (update) =>
      audit.setAuditSearch(
        typeof update === 'function' ? update(audit.auditSearch) : update,
      ),
  });
}

export function AuditTable({
  audit,
  table,
}: {
  audit: AuditState;
  table: Table<AuditEventRecord>;
}) {
  const canLoad = audit.auditStatus === 'CanLoadMore' && !audit.isStale;
  return (
    <div className="flex min-w-0 flex-col gap-3" aria-busy={audit.isStale}>
      <AuditTableContext.Provider value={audit}>
      <DataTable
        table={table}
        loading={audit.isAuditLoading}
        empty={{ title: 'No activity matches these filters.' }}
        onRowClick={(row) => audit.setSelectedAuditEventId(row.original.id)}
      />
      </AuditTableContext.Provider>
      <DataTablePagination table={table} />
      {audit.auditStatus !== 'Exhausted' && !audit.isAuditLoading ? (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Pages cover {audit.displayedAuditEvents.length.toLocaleString()}{' '}
            loaded events.
          </span>
          <Button
            variant="ghost"
            loading={audit.auditStatus === 'LoadingMore'}
            disabled={!canLoad}
            onClick={() => audit.loadMoreAuditEvents(AUDIT_FETCH_LIMIT)}
          >
            Load older activity
          </Button>
        </div>
      ) : null}
    </div>
  );
}
