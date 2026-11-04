'use client';

import { useState } from 'react';
import Image from 'next/image';
import {
  Archive,
  CheckCircle2,
  ChevronDown,
  Ellipsis,
  ExternalLink,
  Eye,
  Github,
  Inbox,
  MessageSquare,
  MonitorSmartphone,
  Paperclip,
  Send,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { displayName } from '~/apps/shared/user-name';
import { canRetryGithubSync } from '~/apps/shared/feedback-sync';
import { STAFF_FEEDBACK_STATUS_LABELS } from '~/apps/shared/feedback-status';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import {
  DataTablePanel,
  dataTableClasses,
} from '@/components/data/data-table-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownContent,
  DropdownMenu,
  DropdownTrigger,
} from '@/components/ui/dropdown';
import { MenuItem } from '@/components/ui/menu-item';
import { SearchInput } from '@/components/ui/search';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { AnimatedGif } from '@/components/media/animated-gif';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UserAvatar } from '@/components/ui/user-avatar';
import { formatDateTime } from '../_lib/admin-utils';
import { AdminNotice } from './admin-ui';

type FeedbackReport = Doc<'moderationReports'> & {
  submitter: {
    firstName: string;
    lastName: string;
    preferredName?: string | null;
  } | null;
  images: Array<{
    _id: Id<'feedbackReportImages'>;
    url: string;
    mimeType: string;
  }>;
  responses: Array<{
    _id: Id<'feedbackReportResponses'>;
    body: string;
    createdAt: number;
    author: {
      firstName: string;
      lastName: string;
      preferredName?: string | null;
    };
  }>;
};
type FeedbackMutation = {
  mutate: (args: {
    id: Id<'moderationReports'>;
    status: FeedbackReport['status'];
    expectedStatus: FeedbackReport['status'];
    reviewNote: string;
  }) => void;
  isPending: boolean;
};
type FeedbackResponseMutation = (args: {
  reportId: Id<'moderationReports'>;
  body: string;
}) => Promise<void>;
type RetryGithubIssueMutation = (
  reportId: Id<'moderationReports'>,
) => Promise<void>;

export function FeedbackTab({
  focusedReport,
  onFocusedReportClose,
  feedbackSearch,
  onFeedbackSearchChange,
  deferredFeedbackSearch,
  filteredReports,
  reportMutation,
  responseMutation,
  retryGithubIssueMutation,
  isLoading,
  canUpdateFeedback = true,
}: {
  focusedReport?: FeedbackReport;
  onFocusedReportClose?: () => void;
  feedbackSearch: string;
  onFeedbackSearchChange: (value: string) => void;
  deferredFeedbackSearch: string;
  filteredReports: FeedbackReport[];
  reportMutation: FeedbackMutation;
  responseMutation: FeedbackResponseMutation;
  retryGithubIssueMutation: RetryGithubIssueMutation;
  isLoading: boolean;
  canUpdateFeedback?: boolean;
}) {
  const [view, setView] = useState('new');
  // Keep response drafts in the queue so closing a detail dialog or changing
  // the queue filter does not discard a message the administrator is writing.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const byStatus = {
    new: filteredReports.filter((report) => report.status === 'PENDING'),
    inReview: filteredReports.filter((report) => report.status === 'IN_REVIEW'),
    resolved: filteredReports.filter((report) => report.status === 'RESOLVED'),
    archive: filteredReports.filter((report) => report.status === 'DISMISSED'),
  };
  const reports = byStatus[view as keyof typeof byStatus];
  const classes = dataTableClasses();

  return (
    <>
      {focusedReport ? (
        <FeedbackDetail
          key={focusedReport._id}
          report={focusedReport}
          body={drafts[focusedReport._id] ?? ''}
          onBodyChange={(body) => setDrafts((current) => ({ ...current, [focusedReport._id]: body }))}
          reportMutation={reportMutation}
          responseMutation={responseMutation}
          retryGithubIssueMutation={retryGithubIssueMutation}
          canUpdateFeedback={canUpdateFeedback}
          defaultOpen
          onClose={onFocusedReportClose}
        />
      ) : null}
      <DataTablePanel
        title="Feedback"
        count={isLoading ? undefined : filteredReports.length}
        toolbar={
          <SearchInput
            className="w-full sm:w-72"
            aria-label="Search feedback"
            value={feedbackSearch}
            onValueChange={onFeedbackSearchChange}
            placeholder="Search feedback…"
            size="sm"
          />
        }
        footer={
          reportMutation.isPending ? (
            <p role="status" className="px-4 py-3 text-sm text-muted-foreground">
              Updating feedback…
            </p>
          ) : undefined
        }
      >
        <Tabs value={view} onValueChange={setView}>
          <div className="px-4 pb-2">
            <TabsList aria-label="Feedback views">
              <TabItem
                value="new"
                label={`New ${byStatus.new.length}`}
                icon={Inbox}
              />
              <TabItem
                value="inReview"
                label={`In review ${byStatus.inReview.length}`}
                icon={Eye}
              />
              <TabItem
                value="resolved"
                label={`Resolved ${byStatus.resolved.length}`}
                icon={CheckCircle2}
              />
              <TabItem
                value="archive"
                label={`Archive ${byStatus.archive.length}`}
                icon={Archive}
              />
            </TabsList>
          </div>
          <TabPanel value={view}>
            {isLoading ? (
              <AdminNotice message="Loading feedback…" />
            ) : reports.length === 0 ? (
              <AdminNotice
                message={
                  deferredFeedbackSearch
                    ? 'No feedback in this view matches your search.'
                    : 'No feedback in this view.'
                }
                actionLabel={deferredFeedbackSearch ? 'Clear search' : undefined}
                onAction={
                  deferredFeedbackSearch
                    ? () => onFeedbackSearchChange('')
                    : undefined
                }
              />
            ) : (
              <Table aria-label="Feedback queue">
                <TableHeader>
                  <TableRow>
                    <TableHead className={classes.head}>Feedback</TableHead>
                    <TableHead className={classes.head}>Submitted by</TableHead>
                    <TableHead className={classes.head}>Submitted</TableHead>
                    <TableHead className={classes.head}>
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report, index) => (
                    <TableRow key={report._id} index={index}>
                      <TableCell className={cn(classes.cell, 'w-full')}>
                        <p className="line-clamp-2 min-w-56 max-w-2xl whitespace-normal break-words font-medium text-foreground">
                          {report.reason}
                        </p>
                        <FeedbackRowMeta report={report} />
                      </TableCell>
                      <TableCell className={cn(classes.cell, 'whitespace-nowrap')}>
                        {displayName(report.submitter)}
                      </TableCell>
                      <TableCell className={cn(classes.cell, 'whitespace-nowrap text-muted-foreground')}>
                        <time dateTime={new Date(report._creationTime).toISOString()}>
                          {formatShortDate(report._creationTime)}
                        </time>
                      </TableCell>
                      <TableCell className={classes.cell}>
                        <div className="flex items-center gap-2">
                          <FeedbackDetail
                            report={report}
                            body={drafts[report._id] ?? ''}
                            onBodyChange={(body) =>
                              setDrafts((current) => ({
                                ...current,
                                [report._id]: body,
                              }))
                            }
                            reportMutation={reportMutation}
                            responseMutation={responseMutation}
                            retryGithubIssueMutation={retryGithubIssueMutation}
                            canUpdateFeedback={canUpdateFeedback}
                          />
                          {canUpdateFeedback ? (
                            <FeedbackStatusActions
                              report={report}
                              reportMutation={reportMutation}
                            />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabPanel>
        </Tabs>
      </DataTablePanel>
    </>
  );
}

type StatusAction = {
  label: string;
  status: FeedbackReport['status'];
  reviewNote: string;
  icon: typeof Inbox;
};

const START_REVIEW: StatusAction = { label: 'Start review', status: 'IN_REVIEW', reviewNote: '', icon: Eye };
const RESOLVE: StatusAction = { label: 'Resolve', status: 'RESOLVED', reviewNote: '', icon: CheckCircle2 };
const ARCHIVE: StatusAction = { label: 'Archive', status: 'DISMISSED', reviewNote: '', icon: Archive };
const MOVE_TO_NEW: StatusAction = { label: 'Move back to New', status: 'PENDING', reviewNote: '', icon: Inbox };
const REOPEN: StatusAction = { label: 'Reopen', status: 'IN_REVIEW', reviewNote: '', icon: Undo2 };

/** The next step for each status leads; the other transitions sit in a menu. */
const STATUS_ACTIONS: Record<
  FeedbackReport['status'],
  { primary: StatusAction; more: StatusAction[] }
> = {
  PENDING: { primary: START_REVIEW, more: [RESOLVE, ARCHIVE] },
  IN_REVIEW: { primary: RESOLVE, more: [ARCHIVE, MOVE_TO_NEW] },
  RESOLVED: { primary: REOPEN, more: [] },
  DISMISSED: { primary: REOPEN, more: [] },
};

function FeedbackStatusActions({
  report,
  reportMutation,
}: {
  report: FeedbackReport;
  reportMutation: FeedbackMutation;
}) {
  const { primary, more } = STATUS_ACTIONS[report.status];
  const run = (action: StatusAction) =>
    reportMutation.mutate({
      id: report._id,
      status: action.status,
      expectedStatus: report.status,
      reviewNote: action.reviewNote,
    });
  const decided = report.status === 'RESOLVED' || report.status === 'DISMISSED';

  return (
    <>
      <Button
        size="sm"
        variant={decided ? 'secondary' : 'primary'}
        leadingIcon={primary.icon}
        disabled={reportMutation.isPending}
        onClick={() => run(primary)}
      >
        {primary.label}
      </Button>
      {more.length ? (
        <DropdownMenu disabled={reportMutation.isPending}>
          <DropdownTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`More actions for feedback from ${displayName(report.submitter)}`}
              >
                <Ellipsis />
              </Button>
            }
          />
          <DropdownContent align="end">
            {more.map((action, index) => (
              <MenuItem
                key={action.status}
                index={index}
                icon={action.icon}
                label={action.label}
                onSelect={() => run(action)}
              />
            ))}
          </DropdownContent>
        </DropdownMenu>
      ) : null}
    </>
  );
}

const STATUS_BADGE_COLORS = {
  PENDING: 'blue',
  IN_REVIEW: 'amber',
  RESOLVED: 'emerald',
  DISMISSED: 'gray',
} as const satisfies Record<FeedbackReport['status'], string>;

function formatShortDate(value: number) {
  const date = new Date(value);
  return format(date, date.getFullYear() === new Date().getFullYear() ? 'MMM d' : 'MMM d, yyyy');
}

/** Only what differs between rows: attachments, replies, or a sync problem. */
function FeedbackRowMeta({ report }: { report: FeedbackReport }) {
  const syncFailed = report.githubIssueSyncState === 'FAILED';
  if (!report.images.length && !report.responses.length && !syncFailed) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {report.images.length ? (
        <span className="inline-flex items-center gap-1">
          <Paperclip className="size-3" aria-hidden />
          {report.images.length}
          <span className="sr-only"> attachments</span>
        </span>
      ) : null}
      {report.responses.length ? (
        <span className="inline-flex items-center gap-1">
          <MessageSquare className="size-3" aria-hidden />
          {report.responses.length}
          <span className="sr-only"> replies</span>
        </span>
      ) : null}
      {syncFailed ? (
        <span className="inline-flex items-center gap-1">
          <TriangleAlert className="size-3 text-amber-500" aria-hidden />
          Not on GitHub
        </span>
      ) : null}
    </p>
  );
}

function FeedbackDetail({
  defaultOpen = false,
  onClose,
  report,
  body,
  onBodyChange,
  reportMutation,
  responseMutation,
  retryGithubIssueMutation,
  canUpdateFeedback,
}: {
  defaultOpen?: boolean;
  onClose?: () => void;
  report: FeedbackReport;
  body: string;
  onBodyChange: (body: string) => void;
  reportMutation: FeedbackMutation;
  responseMutation: FeedbackResponseMutation;
  retryGithubIssueMutation: RetryGithubIssueMutation;
  canUpdateFeedback: boolean;
}) {
  const [isSending, setIsSending] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string>();
  // When this detail opened; a sync that was already stale then can be retried.
  const [openedAt] = useState(() => Date.now());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.trim() || isSending) return;
    setIsSending(true);
    setError(undefined);
    try {
      await responseMutation({ reportId: report._id, body: body.trim() });
      onBodyChange('');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Could not send the response. Your draft is still here.',
      );
    } finally {
      setIsSending(false);
    }
  }

  async function retrySync() {
    if (isRetrying) return;
    setIsRetrying(true);
    setError(undefined);
    try {
      await retryGithubIssueMutation(report._id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not retry GitHub sync.',
      );
    } finally {
      setIsRetrying(false);
    }
  }

  return (
    <Dialog
      defaultOpen={defaultOpen}
      onOpenChange={(open) => {
        if (!open) onClose?.();
      }}
    >
      {!defaultOpen ? (
        <DialogTrigger asChild>
          <Button size="sm" variant="tertiary">
            Details
          </Button>
        </DialogTrigger>
      ) : null}
      <DialogContent size="lg">
        <DialogHeader className="mb-0">
          <div className="flex items-center gap-3 pr-8">
            <UserAvatar person={report.submitter} size={32} />
            <div className="min-w-0">
              <DialogTitle className="truncate">
                {displayName(report.submitter)}
              </DialogTitle>
              <DialogDescription className="text-xs">
                <time dateTime={new Date(report._creationTime).toISOString()}>
                  {formatDateTime(report._creationTime)}
                </time>
                {report.appVersion ? ` · ${report.appVersion}` : ''}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-4 flex items-center justify-between gap-3 border-y border-border/40 py-2.5">
          <Badge color={STATUS_BADGE_COLORS[report.status]} variant="dot">
            {STAFF_FEEDBACK_STATUS_LABELS[report.status]}
          </Badge>
          {canUpdateFeedback ? (
            <div className="flex items-center gap-1">
              <FeedbackStatusActions report={report} reportMutation={reportMutation} />
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed text-foreground">
              {report.reason}
            </p>
            {report.images.length ? (
              <div className="flex flex-wrap gap-2">
                {report.images.map((image, index) => (
                  <a
                    key={image._id}
                    href={image.url}
                    target="_blank"
                    rel="noreferrer"
                    className="block size-20 overflow-hidden rounded-lg border border-border/40 bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {image.mimeType === 'image/gif' ? (
                      <AnimatedGif
                        src={image.url}
                        name={`Feedback attachment ${index + 1}`}
                        thumbnail
                        maxHeight={80}
                      />
                    ) : (
                      <Image
                        src={image.url}
                        width={80}
                        height={80}
                        unoptimized
                        alt={`Feedback attachment ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        className="size-full object-cover"
                      />
                    )}
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <Collapsible className="text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {report.githubIssueUrl ? (
                <a
                  href={report.githubIssueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <Github className="size-3.5" aria-hidden />
                  Issue #{report.githubIssueNumber}
                  <ExternalLink className="size-3" aria-hidden />
                </a>
              ) : report.githubIssueSyncState && canRetryGithubSync(report, openedAt) ? (
                <span className="inline-flex items-center gap-1.5">
                  <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />
                  {report.githubIssueSyncState === 'FAILED'
                    ? 'Not on GitHub yet'
                    : 'GitHub sync stalled'}
                  {canUpdateFeedback ? (
                    <>
                      <span aria-hidden>·</span>
                      <button
                        type="button"
                        disabled={isRetrying}
                        onClick={() => void retrySync()}
                        className="rounded-sm font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                      >
                        {isRetrying ? 'Retrying…' : 'Retry'}
                      </button>
                    </>
                  ) : null}
                </span>
              ) : null}
              {report.clientMetadata ? (
                <CollapsibleTrigger className="group inline-flex items-center gap-1.5 rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <MonitorSmartphone className="size-3.5" aria-hidden />
                  Device details
                  <ChevronDown
                    className="size-3 transition-transform group-data-[state=open]:rotate-180 motion-reduce:transition-none"
                    aria-hidden
                  />
                </CollapsibleTrigger>
              ) : null}
            </div>
            {report.clientMetadata ? (
              <CollapsibleContent>
                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-lg bg-muted/40 p-3">
                  <dt>Browser</dt>
                  <dd className="break-words text-foreground">
                    {report.clientMetadata.userAgent}
                  </dd>
                  <dt>Display</dt>
                  <dd className="text-foreground">
                    {report.clientMetadata.viewportWidth}×{report.clientMetadata.viewportHeight} viewport ·{' '}
                    {report.clientMetadata.screenWidth}×{report.clientMetadata.screenHeight} screen ·{' '}
                    {report.clientMetadata.pixelRatio}× · {report.clientMetadata.displayMode}
                  </dd>
                  <dt>Locale</dt>
                  <dd className="text-foreground">
                    {report.clientMetadata.language} · {report.clientMetadata.timezone}
                  </dd>
                </dl>
              </CollapsibleContent>
            ) : null}
          </Collapsible>

          {report.responses.length || canUpdateFeedback || error ? (
            <section
              aria-label="Staff responses"
              className="flex flex-col gap-4 border-t border-border/40 pt-5"
            >
              {report.responses.map((response) => (
                <div key={response._id} className="flex gap-3">
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {displayName(response.author)}
                      </span>{' '}
                      · {formatDateTime(response.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {response.body}
                    </p>
                  </div>
                </div>
              ))}
              {canUpdateFeedback ? (
                <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                  <Textarea
                    aria-label={`Reply to ${displayName(report.submitter)}`}
                    aria-describedby={`feedback-response-help-${report._id}`}
                    placeholder={`Reply to ${displayName(report.submitter)}…`}
                    value={body}
                    onChange={(event) => onBodyChange(event.target.value)}
                    maxLength={1_000}
                    rows={2}
                    disabled={isSending}
                  />
                  {error ? (
                    <p role="alert" className="text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <p
                      id={`feedback-response-help-${report._id}`}
                      className="text-xs text-muted-foreground"
                    >
                      They can read replies but can’t respond.
                    </p>
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      leadingIcon={Send}
                      loading={isSending}
                      disabled={!body.trim() || isSending}
                    >
                      Reply
                    </Button>
                  </div>
                </form>
              ) : error ? (
                <p role="alert" className="text-xs text-destructive">
                  {error}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
