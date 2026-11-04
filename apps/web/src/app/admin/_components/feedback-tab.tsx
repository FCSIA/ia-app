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
  Globe,
  Inbox,
  Maximize2,
  MessageSquare,
  MonitorSmartphone,
  RefreshCw,
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
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
  DialogFooter,
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
                    <TableHead className={classes.head}>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report, index) => (
                    <TableRow key={report._id} index={index}>
                      <TableCell className={classes.cell}>
                        <p className="line-clamp-2 min-w-48 max-w-md whitespace-normal break-words font-medium text-foreground">
                          {report.reason}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {report.images.length} attachments ·{' '}
                          {report.responses.length} responses
                          {report.githubIssueSyncState === 'FAILED'
                            ? ' · GitHub sync failed'
                            : ''}
                        </p>
                      </TableCell>
                      <TableCell className={classes.cell}>
                        {displayName(report.submitter)}
                      </TableCell>
                      <TableCell className={classes.cell}>
                        {formatDateTime(report._creationTime)}
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

function DetailRow({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Inbox;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[1rem_1fr] gap-x-2 gap-y-0.5">
      <Icon className="mt-0.5 size-4 text-muted-foreground" aria-hidden />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="col-start-2 break-words">{children}</dd>
    </div>
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
        <DialogHeader>
          <DialogTitle>
            Feedback from {displayName(report.submitter)}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <Badge size="sm" color={STATUS_BADGE_COLORS[report.status]}>
              {STAFF_FEEDBACK_STATUS_LABELS[report.status]}
            </Badge>
            <span>
              {formatDateTime(report._creationTime)}
              {report.appVersion ? ` · ${report.appVersion}` : ''}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3">
            <p className="whitespace-pre-wrap break-words border-l-2 border-border/60 pl-3 text-sm leading-6 text-foreground">
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

          {report.githubIssueSyncState && canRetryGithubSync(report, openedAt) ? (
            <Alert variant="destructive" role="status">
              <TriangleAlert className="size-4" aria-hidden />
              <AlertTitle>
                {report.githubIssueSyncState === 'FAILED'
                  ? 'GitHub sync failed'
                  : 'GitHub sync stopped before finishing'}
              </AlertTitle>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-muted-foreground">
                <span>This feedback is still saved in the app.</span>
                {canUpdateFeedback ? (
                  <Button
                    size="sm"
                    variant="tertiary"
                    leadingIcon={RefreshCw}
                    loading={isRetrying}
                    onClick={() => void retrySync()}
                  >
                    Retry sync
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            {report.githubIssueUrl ? (
              <Button
                asChild
                size="sm"
                variant="tertiary"
                leadingIcon={Github}
                trailingIcon={ExternalLink}
              >
                <a href={report.githubIssueUrl} target="_blank" rel="noreferrer">
                  Issue #{report.githubIssueNumber}
                </a>
              </Button>
            ) : null}
            {report.clientMetadata ? (
              <Collapsible>
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    leadingIcon={MonitorSmartphone}
                    trailingIcon={ChevronDown}
                  >
                    Device details
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <dl className="mt-3 grid gap-3 text-sm">
                    <DetailRow icon={MonitorSmartphone} label="Browser / device">
                      {report.clientMetadata.userAgent}
                    </DetailRow>
                    <DetailRow icon={Maximize2} label="Display">
                      {report.clientMetadata.viewportWidth} ×{' '}
                      {report.clientMetadata.viewportHeight} viewport ·{' '}
                      {report.clientMetadata.screenWidth} ×{' '}
                      {report.clientMetadata.screenHeight} screen ·{' '}
                      {report.clientMetadata.pixelRatio}× ·{' '}
                      {report.clientMetadata.displayMode}
                    </DetailRow>
                    <DetailRow icon={Globe} label="Locale">
                      {report.clientMetadata.language} ·{' '}
                      {report.clientMetadata.timezone}
                    </DetailRow>
                  </dl>
                </CollapsibleContent>
              </Collapsible>
            ) : null}
          </div>

          {report.responses.length || canUpdateFeedback || error ? (
            <section
              aria-label="Staff responses"
              className="flex flex-col gap-4 border-t border-border/40 pt-4"
            >
              {report.responses.length ? (
                <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MessageSquare className="size-4 text-muted-foreground" aria-hidden />
                  Responses
                  <span className="tabular-nums text-muted-foreground">
                    {report.responses.length}
                  </span>
                </h3>
              ) : null}
              {report.responses.map((response) => (
                <div key={response._id} className="border-l-2 border-border/60 pl-3">
                  <p className="text-xs text-muted-foreground">
                    {displayName(response.author)} ·{' '}
                    {formatDateTime(response.createdAt)}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm">
                    {response.body}
                  </p>
                </div>
              ))}
              {canUpdateFeedback ? (
                <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                  <Textarea
                    aria-label={`Respond to feedback from ${displayName(report.submitter)}`}
                    aria-describedby={`feedback-response-help-${report._id}`}
                    placeholder="Reply to the submitter…"
                    value={body}
                    onChange={(event) => onBodyChange(event.target.value)}
                    maxLength={1_000}
                    rows={3}
                    disabled={isSending}
                  />
                  {error ? (
                    <p role="alert" className="text-sm text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p
                      id={`feedback-response-help-${report._id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Read-only for the submitter. Drafts are kept.
                    </p>
                    <Button
                      type="submit"
                      size="sm"
                      variant="secondary"
                      leadingIcon={Send}
                      loading={isSending}
                      disabled={!body.trim() || isSending}
                    >
                      Send
                    </Button>
                  </div>
                </form>
              ) : error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </section>
          ) : null}
        </div>
        {canUpdateFeedback ? (
          <DialogFooter className="border-t border-border/40 pt-4">
            {/* One footer child, so the narrow-screen stack keeps the menu
                beside the action it belongs to. */}
            <div className="flex items-center justify-end gap-2">
              <FeedbackStatusActions report={report} reportMutation={reportMutation} />
            </div>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
