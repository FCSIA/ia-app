'use client';

import { useMemo, type ReactNode } from 'react';
import {
  useDataTable,
  DataTableColumnHeader,
  type ColumnDef,
} from '@/components/ui/data-table';
import { AdminDataTable } from './admin-data-table';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

import type { RosterCsvPreview } from '../_lib/roster-csv';
import { normalizeCsvHeader } from '~/apps/shared/csv';
import type {
  StudentBulkUpdateResult,
  StudentImportResult,
} from '../_lib/types';
import { AdminPanel } from './admin-ui';

export function RosterCsvHelp({ children }: { children: ReactNode }) {
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          CSV requirements and example
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-3 text-sm text-muted-foreground">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function RosterCsvReview({
  preview,
  clearsBlanks = false,
}: {
  preview: RosterCsvPreview<unknown>;
  clearsBlanks?: boolean;
}) {
  type CsvRow = RosterCsvPreview<unknown>['rows'][number];
  const columns = useMemo<ColumnDef<CsvRow>[]>(
    () => [
      {
        accessorKey: 'line',
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Line" />
        ),
      },
      ...preview.headers.map((header, index): ColumnDef<CsvRow> => ({
        id: `cell-${index}`,
        accessorFn: (row) => row.cells[index],
        header: ({ column }) => (
          <DataTableColumnHeader
            column={column}
            title={header || '(missing header)'}
          />
        ),
        meta: { label: header || '(missing header)' },
        cell: ({ row }) =>
          row.original.cells[index] ||
          (clearsBlanks &&
          [
            'grade',
            'gradelevel',
            'major',
            'majorpathway',
            'pathway',
            'minor',
            'minorpathway',
          ].includes(normalizeCsvHeader(header))
            ? '(clear)'
            : '—'),
      })),
      {
        id: 'validation',
        accessorFn: (row) => row.issues.join(' ') || 'Ready',
        header: 'Validation',
        meta: { lines: 'wrap' },
        cell: ({ row }) =>
          row.original.issues.length ? (
            <ul className="text-destructive">
              {row.original.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          ) : (
            'Ready'
          ),
      },
    ],
    [preview.headers, clearsBlanks],
  );
  const table = useDataTable({
    data: preview.rows,
    columns,
    getRowId: (row) => String(row.line),
  });
  const invalid = preview.rows.filter((row) => row.issues.length > 0).length;
  return (
    <div className="min-w-0 space-y-2">
      {preview.issues.length ? (
        <ul className="space-y-1 px-4 text-sm text-destructive" role="alert">
          {preview.issues.map((issue) => (
            <li key={issue}>{issue}</li>
          ))}
        </ul>
      ) : null}
      {invalid ? (
        <ul
          className="space-y-1 px-4 text-sm text-destructive"
          aria-label="Row validation errors"
        >
          {preview.rows
            .filter((row) => row.issues.length)
            .map((row) => (
              <li key={row.line}>
                Line {row.line}: {row.issues.join(' ')}
              </li>
            ))}
        </ul>
      ) : null}
      <p className="text-sm text-muted-foreground" role="status">
        {preview.issues.length
          ? 'Fix CSV errors before continuing'
          : invalid
            ? `${invalid} ${invalid === 1 ? 'row needs' : 'rows need'} correction`
            : 'All rows passed file validation'}
      </p>
      <AdminDataTable table={table} empty="No CSV rows to review." />
    </div>
  );
}

export function RosterImportResult({
  result,
  onExportPasswords,
}: {
  result: StudentImportResult;
  onExportPasswords: () => void;
}) {
  return (
    <AdminPanel title="Latest import" contentClassName="space-y-3">
      <p className="text-sm">
        {result.created} created · {result.skipped} skipped
      </p>
      {result.generatedCredentials.length ? (
        <div className="space-y-2">
          <Button
            type="button"
            leadingIcon={Download}
            onClick={onExportPasswords}
          >
            Export {result.generatedCredentials.length} temporary passwords
          </Button>
          <p className="text-xs text-muted-foreground">
            Export now. Passwords are available only in this browser session;
            share them through an approved secure channel.
          </p>
        </div>
      ) : null}
      <RosterErrors errors={result.errors} />
    </AdminPanel>
  );
}

export function RosterUpdateResult({
  result,
}: {
  result: StudentBulkUpdateResult;
}) {
  return (
    <AdminPanel title="Latest bulk update" contentClassName="space-y-3">
      <p className="text-sm">
        {result.updated} updated · {result.skipped} skipped
      </p>
      <RosterErrors errors={result.errors} />
    </AdminPanel>
  );
}

function RosterErrors({ errors }: { errors: string[] }) {
  if (!errors.length) return null;
  return (
    <Collapsible>
      <CollapsibleTrigger asChild>
        <Button type="button" variant="ghost" size="sm">
          Review {errors.length} skipped-row messages
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="space-y-1 pt-3 text-sm text-muted-foreground">
          {errors.map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  );
}
