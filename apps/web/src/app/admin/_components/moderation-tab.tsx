'use client';

import { displayName } from '~/apps/shared/user-name';

import {
  CheckCircle2,
  CircleSlash,
  Info,
  Plus,
  Trash2,
  Undo2,
} from 'lucide-react';
import type { Id, Doc } from '~/apps/convex/src/_generated/dataModel';
import { Button, iconSizeFor } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DataTablePanel,
  dataTableClasses,
} from '@/components/data/data-table-panel';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  ReportStatusActions,
  type ReportStatusAction,
} from '@/components/moderation/report-status-actions';
import { ReportStatusBadge } from '@/components/moderation/report-status-badge';
import { cn } from '@/lib/utils';
import { formatDateTime, formatShortDate } from '../_lib/admin-utils';
import { AdminNotice } from './admin-ui';

type ModerationMutation<TArgs> = {
  mutate: (args: TArgs) => void;
  isPending: boolean;
};

type ModerationKeyword = Doc<'moderationKeywordRules'>;
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

/** Same anatomy as the feedback queue: the next step leads, the rest in a menu. */
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

export function ModerationTab({
  keyword,
  onKeywordChange,
  keywords,
  addKeywordMutation,
  removeKeywordMutation,
  moderationSearch,
  onModerationSearchChange,
  deferredModerationSearch,
  filteredReports,
  pendingReports,
  reportMutation,
  isLoading,
  isKeywordsLoading,
}: {
  isLoading: boolean;
  isKeywordsLoading: boolean;
  keyword: string;
  onKeywordChange: (value: string) => void;
  keywords: ModerationKeyword[];
  addKeywordMutation: ModerationMutation<string>;
  removeKeywordMutation: ModerationMutation<string>;
  moderationSearch: string;
  onModerationSearchChange: (value: string) => void;
  deferredModerationSearch: string;
  filteredReports: ModerationReport[];
  pendingReports: number;
  reportMutation: ModerationMutation<{
    id: Id<'moderationReports'>;
    status: ModerationReportStatus;
    expectedStatus: ModerationReportStatus;
    reviewNote: string;
  }>;
}) {
  const classes = dataTableClasses();
  const actions = (
    <>
      <SearchInput
        className="min-w-0 flex-1 sm:w-72 sm:flex-none"
        value={moderationSearch}
        onValueChange={onModerationSearchChange}
        aria-label="Search reports"
        placeholder="Search reports..."
        size="sm"
      />
      <Dialog>
        <DialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Manage local safety rules"
            title="Safety rules"
          >
            <Info size={iconSizeFor('icon-sm')} aria-hidden="true" />
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
                onChange={(e) => onKeywordChange(e.target.value)}
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
                    <Trash2 size={iconSizeFor('icon-sm')} aria-hidden="true" />
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

  return (
    <DataTablePanel
      title="Report queue"
      count={isLoading ? undefined : filteredReports.length}
      toolbar={actions}
      footer={
        reportMutation.isPending ? (
          <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
            Updating report…
          </p>
        ) : !isLoading && pendingReports > 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {pendingReports} pending review
          </p>
        ) : undefined
      }
    >
      {isLoading ? (
        <AdminNotice message="Loading reports…" />
      ) : filteredReports.length === 0 ? (
        <AdminNotice
          message={
            deferredModerationSearch
              ? 'No reports match your search.'
              : 'No reports submitted.'
          }
          actionLabel={deferredModerationSearch ? 'Clear search' : undefined}
          onAction={
            deferredModerationSearch
              ? () => onModerationSearchChange('')
              : undefined
          }
        />
      ) : (
        <Table aria-label="Moderation reports">
          <TableHeader>
            <TableRow>
              <TableHead className={classes.head}>Report</TableHead>
              <TableHead className={classes.head}>Submitted by</TableHead>
              <TableHead className={classes.head}>Submitted</TableHead>
              <TableHead className={classes.head}>Status</TableHead>
              <TableHead className={classes.head}>
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredReports.map((report, index) => (
              <TableRow key={report._id} index={index}>
                <TableCell className={cn(classes.cell, 'w-full')}>
                  <p className="line-clamp-2 min-w-56 max-w-2xl whitespace-normal break-words font-medium text-foreground">
                    {report.reason}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {CONTENT_TYPE_LABELS[report.contentType] ?? 'Content'}
                    {report.reportedUser
                      ? ` by ${displayName(report.reportedUser)}`
                      : ''}
                  </p>
                </TableCell>
                <TableCell className={cn(classes.cell, 'whitespace-nowrap')}>
                  {displayName(report.submitter)}
                </TableCell>
                <TableCell
                  className={cn(
                    classes.cell,
                    'whitespace-nowrap text-muted-foreground',
                  )}
                >
                  <time
                    dateTime={new Date(report._creationTime).toISOString()}
                    title={formatDateTime(report._creationTime)}
                  >
                    {formatShortDate(report._creationTime)}
                  </time>
                </TableCell>
                <TableCell className={classes.cell}>
                  <ReportStatusBadge
                    status={report.status}
                    audience="moderation"
                  />
                </TableCell>
                <TableCell className={cn(classes.cell, 'whitespace-nowrap')}>
                  <div className="flex justify-end">
                    <ReportStatusActions
                      {...MODERATION_ACTIONS[report.status]}
                      emphasis={
                        report.status === 'PENDING' ? 'primary' : 'secondary'
                      }
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
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </DataTablePanel>
  );
}
