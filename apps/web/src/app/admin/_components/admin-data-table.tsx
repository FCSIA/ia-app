'use client';

import type { ReactNode } from 'react';
import type { Row, Table } from '@tanstack/react-table';
import {
  DataTable,
  DataTableSearch,
  DataTableViewOptions,
  DataTablePagination,
} from '@/components/ui/data-table';
import {
  DataTableCount,
  DataTableSection,
} from '@/components/data/data-table-section';
import { SearchToolbarRow } from '@/components/ui/search';

/**
 * The admin table anatomy: a pinned toolbar (search, the tab's own controls,
 * column options, live count), then the Fluid table and its footer. Callers own
 * their data and table state; `mobile` replaces the table below `md`.
 * Without a `label` the table is embedded (a dialog or preview): the toolbar
 * stays in flow instead of pinning to the tab's scroll viewport.
 */
export function AdminDataTable<T>({
  label,
  table,
  loading,
  empty,
  searchPlaceholder,
  controls,
  count,
  toolbarBelow,
  mobile,
  footer,
  onRowClick,
}: {
  label?: string;
  table: Table<T>;
  loading?: boolean;
  empty?: string;
  searchPlaceholder?: string;
  /** Tab-specific controls placed between search and column options. */
  controls?: ReactNode;
  count?: ReactNode;
  /** A second toolbar line, e.g. view tabs or a selection bar. */
  toolbarBelow?: ReactNode;
  mobile?: ReactNode;
  /** Replaces the client-side pagination, e.g. for server cursors. */
  footer?: ReactNode;
  onRowClick?: (row: Row<T>) => void;
}) {
  const desktop = (
    <DataTable
      table={table}
      loading={loading}
      empty={empty ? { title: empty } : undefined}
      onRowClick={onRowClick}
    />
  );
  const toolbar = (
    <>
      <SearchToolbarRow className="flex-row flex-wrap items-center gap-2">
        <DataTableSearch table={table} placeholder={searchPlaceholder} />
        {/* Trailing controls sit at the row's end, as in the audit log. */}
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {controls}
          <DataTableViewOptions table={table} className="hidden md:inline-flex" />
          {count != null ? <DataTableCount>{count}</DataTableCount> : null}
        </div>
      </SearchToolbarRow>
      {toolbarBelow}
    </>
  );
  // Client pages cover the table only; phone cards list every row.
  const pagination =
    footer === undefined ? (
      <div className="pt-3">
        <DataTablePagination table={table} />
      </div>
    ) : null;
  const body = (
    <>
      {mobile ? (
        <>
          <div className="hidden min-w-0 md:block">
            {desktop}
            {pagination}
          </div>
          <div className="md:hidden">{mobile}</div>
        </>
      ) : (
        <>
          {desktop}
          {pagination}
        </>
      )}
      {footer}
    </>
  );
  if (!label)
    return (
      <div className="flex min-w-0 flex-col gap-3">
        {toolbar}
        <div className="min-w-0">{body}</div>
      </div>
    );
  return (
    <DataTableSection label={label} toolbar={toolbar}>
      {body}
    </DataTableSection>
  );
}
