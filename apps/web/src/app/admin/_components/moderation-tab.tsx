'use client';

import { displayName } from '~/apps/shared/user-name';
import {
  useDataTable,
  DataTableColumnHeader,
  type ColumnDef,
} from '@/components/ui/data-table';
import { AdminDataTable } from './admin-data-table';

import {
  CheckCircle2,
  CircleSlash,
  Info,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { Doc } from '~/apps/convex/src/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Card,
  CardDescription,
  CardFooter,
  CardGroup,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  ReportStatusActions,
  type ReportStatusAction,
} from '@/components/moderation/report-status-actions';
import { ReportStatusBadge } from '@/components/moderation/report-status-badge';
import { formatDateTime, formatShortDate } from '../_lib/admin-utils';
import { useAdminModeration } from '../_hooks/use-admin-moderation';
import { useAdminModerationPending } from '../_hooks/use-admin-moderation-pending';
import { AdminNotice } from './admin-ui';

type ModerationReport = Doc<'moderationReports'> & {
  submitter: {
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  } | null;
  reportedUser: {
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  } | null;
};
type ModerationReportStatus = ModerationReport['status'];
type ModerationAction = ReportStatusAction<ModerationReportStatus>;

const RESOLVE: ModerationAction = {
  label: 'Resolve',
  status: 'RESOLVED',
  icon: CheckCircle2,
};
const DISMISS: ModerationAction = {
  label: 'Dismiss',
  status: 'DISMISSED',
  icon: CircleSlash,
};
const REOPEN: ModerationAction = {
  label: 'Reopen',
  status: 'PENDING',
  icon: Undo2,
};

/** Same anatomy as the feedback queue: the next step leads, then the alternatives. */
const MODERATION_ACTIONS: Record<
  ModerationReportStatus,
  { primary: ModerationAction; more: ModerationAction[] }
> = {
  PENDING: { primary: RESOLVE, more: [DISMISS] },
  // Moderation reports are never put in review; listed for completeness.
  IN_REVIEW: { primary: RESOLVE, more: [DISMISS] },
  RESOLVED: { primary: REOPEN, more: [] },
  DISMISSED: { primary: REOPEN, more: [] },
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  ANNOUNCEMENT: 'Announcement',
  EVENT: 'Event',
  CLUB_CHANNEL_MESSAGE: 'Club message',
};

export function ModerationTab() {
  const {
    keyword,
    setKeyword,
    keywords,
    addKeywordMutation,
    removeKeywordMutation,
    moderationSearch,
    setModerationSearch,
    deferredModerationSearch,
    filteredReports,
    reportMutation,
    isLoading,
    isKeywordsLoading,
  } = useAdminModeration();
  const pendingReports = useAdminModerationPending();
  const actions = (
    <>
      <Dialog>
        <DialogTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Manage local safety rules"
            title="Safety rules"
          >
            <Info />
          </Button>
        </DialogTrigger>
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>Local safety rules</DialogTitle>
            <DialogDescription className="pt-2 text-sm leading-relaxed">
              Local keywords filter preferred names before they are saved. Other
              content, including club messages, uses manual reports for staff
              review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                Custom keywords
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                className="bg-background"
                aria-label="Local safety keyword"
                placeholder="Add local term..."
                value={keyword}
                disabled={addKeywordMutation.isPending}
                onChange={(e) => setKeyword(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === 'Enter' &&
                    keyword.trim() &&
                    !addKeywordMutation.isPending
                  )
                    addKeywordMutation.mutate(keyword.trim());
                }}
              />
              <Button
                type="button"
                onClick={() =>
                  keyword.trim() && addKeywordMutation.mutate(keyword.trim())
                }
                leadingIcon={Plus}
                disabled={!keyword.trim() || addKeywordMutation.isPending}
                loading={addKeywordMutation.isPending}
                className="shrink-0"
              >
                Add rule
              </Button>
            </div>

            <ul className="divide-y divide-border/40">
              {keywords.map((kw) => (
                <li
                  key={kw._id}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span className="text-sm">{kw.keyword}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={removeKeywordMutation.isPending}
                    onClick={() => removeKeywordMutation.mutate(kw._id)}
                    aria-label={`Remove ${kw.keyword}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
            {isKeywordsLoading ? (
              <p role="status" className="text-sm text-muted-foreground">
                Loading local safety rules…
              </p>
            ) : keywords.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No local safety rules configured.
              </p>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );

  const empty = (
    <AdminNotice
      message={
        deferredModerationSearch
          ? 'No reports match your search.'
          : 'No reports submitted.'
      }
      actionLabel={deferredModerationSearch ? 'Clear search' : undefined}
      onAction={
        deferredModerationSearch
          ? () => setModerationSearch('')
          : undefined
      }
    />
  );
  const actionsFor = (report: ModerationReport) => (
    <ReportStatusActions
      {...MODERATION_ACTIONS[report.status]}
      emphasis={report.status === 'PENDING' ? 'primary' : 'secondary'}
      disabled={reportMutation.isPending}
      menuLabel={`report from ${displayName(report.submitter)}`}
      onRun={(action) =>
        reportMutation.mutate({
          id: report._id,
          status: action.status,
          expectedStatus: report.status,
          reviewNote: '',
        })
      }
    />
  );
  const context = (report: ModerationReport) =>
    `${CONTENT_TYPE_LABELS[report.contentType] ?? 'Content'}${
      report.reportedUser ? ` by ${displayName(report.reportedUser)}` : ''
    }`;

  const columns: ColumnDef<ModerationReport>[] = [
      {
        id: 'report',
        accessorFn: (report) => report.reason,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Report" />
        ),
        cell: ({ row }) => (
          <>
            <p className="truncate text-foreground" title={row.original.reason}>
              {row.original.reason}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {context(row.original)}
            </p>
          </>
        ),
        meta: { label: 'Report' },
      },
      {
        id: 'submitted-by',
        accessorFn: (report) => displayName(report.submitter),
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Submitted by" />
        ),
        cell: ({ row }) => (
          <span className="block truncate">
            {displayName(row.original.submitter)}
          </span>
        ),
        meta: { label: 'Submitted by' },
      },
      {
        id: 'submitted',
        accessorFn: (report) => report._creationTime,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Submitted" />
        ),
        cell: ({ row }) => (
          <time
            className="whitespace-nowrap tabular-nums"
            dateTime={new Date(row.original._creationTime).toISOString()}
            title={formatDateTime(row.original._creationTime)}
          >
            {formatShortDate(row.original._creationTime)}
          </time>
        ),
        meta: { label: 'Submitted' },
      },
      {
        id: 'status',
        accessorFn: (report) => report.status,
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <ReportStatusBadge status={row.original.status} audience="moderation" />
        ),
        meta: { label: 'Status' },
      },
      {
        id: 'actions',
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <div className="flex justify-end">{actionsFor(row.original)}</div>
        ),
        meta: { label: 'Actions' },
      },
  ];
  const table = useDataTable({
    data: filteredReports,
    columns,
    pageSize: 20,
    getRowId: (report) => report._id,
    manualFiltering: true,
    state: { globalFilter: moderationSearch },
    onGlobalFilterChange: (update) =>
      setModerationSearch(
        typeof update === 'function' ? update(moderationSearch) : update,
      ),
  });

  return (
    <AdminDataTable
      label="Report queue"
      table={table}
      loading={isLoading}
      searchPlaceholder="Search reports…"
      controls={actions}
      count={
        isLoading
          ? '—'
          : pendingReports > 0
            ? `${pendingReports} pending · ${filteredReports.length} total`
            : `${filteredReports.length} ${filteredReports.length === 1 ? 'report' : 'reports'}`
      }
      empty={
        deferredModerationSearch
          ? 'No reports match your search.'
          : 'No reports submitted.'
      }
      mobile={
        isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-20 w-full" />
            ))}
          </div>
        ) : filteredReports.length ? (
          <CardGroup border="none" corners="compact">
            {filteredReports.map((report) => (
              <Card key={report._id}>
                <CardHeader>
                  <CardTitle>
                    <span className="flex min-w-0 items-start justify-between gap-2">
                      <span className="line-clamp-2">{report.reason}</span>
                      <ReportStatusBadge
                        status={report.status}
                        audience="moderation"
                      />
                    </span>
                  </CardTitle>
                  <CardDescription className="truncate">
                    {context(report)} · {displayName(report.submitter)} ·{' '}
                    {formatShortDate(report._creationTime)}
                  </CardDescription>
                </CardHeader>
                <CardFooter>{actionsFor(report)}</CardFooter>
              </Card>
            ))}
          </CardGroup>
        ) : (
          empty
        )
      }
    />
  );
}
