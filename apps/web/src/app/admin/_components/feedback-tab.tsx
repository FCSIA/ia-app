'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import {
  Archive,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  Eye,
  Github,
  Inbox,
  MessageSquare,
  Paperclip,
  Send,
  TriangleAlert,
  Undo2,
} from 'lucide-react';
import { displayName } from '~/apps/shared/user-name';
import { canRetryGithubSync } from '~/apps/shared/feedback-sync';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import {
  DataTableCount,
  DataTableSection,
  PINNED_TABLE_HEADER,
} from '@/components/data/data-table-section';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { useMutation } from '@/lib/convex-react';
import { useToast } from '@/hooks/use-toast';
import { api } from '~/apps/convex/src/_generated/api';
import {
  Card,
  CardDescription,
  CardGroup,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SearchInput, SearchToolbarRow } from '@/components/ui/search';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
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
import { UserAvatar } from '@/components/ui/user-avatar';
import { AnimatedGif } from '@/components/media/animated-gif';
import {
  ReportStatusActions,
  type ReportStatusAction,
} from '@/components/moderation/report-status-actions';
import { ReportStatusBadge } from '@/components/moderation/report-status-badge';
import { formatDateTime, formatShortDate } from '../_lib/admin-utils';
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
type ApproveBugMutation = (reportId: Id<'moderationReports'>) => Promise<void>;

const VIEWS = [
  { value: 'new', label: 'New', icon: Inbox, status: 'PENDING' },
  { value: 'inReview', label: 'In review', icon: Eye, status: 'IN_REVIEW' },
  { value: 'resolved', label: 'Resolved', icon: CheckCircle2, status: 'RESOLVED' },
  { value: 'archive', label: 'Archive', icon: Archive, status: 'DISMISSED' },
] as const;

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
  approveBugMutation,
  canApproveBugs = false,
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
  approveBugMutation: ApproveBugMutation;
  canApproveBugs?: boolean;
  isLoading: boolean;
  canUpdateFeedback?: boolean;
}) {
  const [view, setView] = useState<(typeof VIEWS)[number]['value']>('new');
  // Drafts live in the queue so closing the sheet or changing views keeps a
  // reply the reviewer is still writing.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [selectedId, setSelectedId] = useState<Id<'moderationReports'> | null>(null);
  // A direct report link opens its sheet until the reviewer closes it.
  const openId = selectedId ?? focusedReport?._id ?? null;
  const selected =
    filteredReports.find((report) => report._id === openId) ??
    (focusedReport?._id === openId ? focusedReport : undefined);
  const byStatus = Object.fromEntries(
    VIEWS.map((item) => [
      item.value,
      filteredReports.filter((report) => report.status === item.status),
    ]),
  ) as Record<(typeof VIEWS)[number]['value'], FeedbackReport[]>;
  const reports = byStatus[view];
  const columns = canUpdateFeedback ? 5 : 4;

  const close = () => {
    if (openId === focusedReport?._id) onFocusedReportClose?.();
    setSelectedId(null);
  };
  const empty = (
    <AdminNotice
      message={
        deferredFeedbackSearch
          ? 'No feedback in this view matches your search.'
          : 'No feedback in this view.'
      }
      actionLabel={deferredFeedbackSearch ? 'Clear search' : undefined}
      onAction={deferredFeedbackSearch ? () => onFeedbackSearchChange('') : undefined}
    />
  );

  return (
    <Tabs value={view} onValueChange={(value) => setView(value as typeof view)}>
      <DataTableSection
        label="Feedback"
        toolbar={
          <>
            <SearchToolbarRow className="flex-row items-center gap-2">
              <SearchInput
                className="min-w-0 flex-1"
                aria-label="Search feedback"
                value={feedbackSearch}
                onValueChange={onFeedbackSearchChange}
                placeholder="Search feedback…"
              />
              <DataTableCount>
                {isLoading
                  ? '—'
                  : `${filteredReports.length} ${deferredFeedbackSearch ? (filteredReports.length === 1 ? 'match' : 'matches') : 'items'}`}
              </DataTableCount>
            </SearchToolbarRow>
            <TabsList aria-label="Feedback views">
              {VIEWS.map((item) => (
                <TabItem
                  key={item.value}
                  value={item.value}
                  label={`${item.label} ${byStatus[item.value].length}`}
                  icon={item.icon}
                />
              ))}
            </TabsList>
          </>
        }
      >
        <TabPanel value={view}>
          <div className="hidden md:block">
            <Table className="table-fixed" aria-label="Feedback queue" aria-busy={reportMutation.isPending}>
              <colgroup>
                <col />
                <col className="w-[11rem]" />
                <col className="w-[5.5rem]" />
                {canUpdateFeedback ? <col className="w-[11.5rem]" /> : null}
                <col className="w-11" />
              </colgroup>
              <TableHeader className={PINNED_TABLE_HEADER}>
                <TableRow>
                  <TableHead scope="col">Feedback</TableHead>
                  <TableHead scope="col">Submitted by</TableHead>
                  <TableHead scope="col">Submitted</TableHead>
                  {canUpdateFeedback ? (
                    <TableHead scope="col">
                      <span className="sr-only">Status actions</span>
                    </TableHead>
                  ) : null}
                  <TableHead scope="col">
                    <span className="sr-only">Details</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 6 }, (_, index) => (
                    <TableRow key={index}>
                      <TableCell colSpan={columns}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : reports.length ? (
                  reports.map((report, index) => (
                    <TableRow
                      key={report._id}
                      index={index}
                      interactive
                      selected={report._id === openId}
                      onClick={(click) => {
                        const target = click.target;
                        if (
                          !(target instanceof Element) ||
                          target.closest('button,a,input,textarea,[role="button"],[role="menuitem"]')
                        )
                          return;
                        setSelectedId(report._id);
                      }}
                    >
                      <TableCell className="py-2">
                        <p className="truncate text-foreground" title={report.reason}>
                          {report.reason}
                        </p>
                        <FeedbackRowMeta report={report} />
                      </TableCell>
                      <TableCell>
                        <span className="block truncate">{displayName(report.submitter)}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap tabular-nums">
                        <time
                          dateTime={new Date(report._creationTime).toISOString()}
                          title={formatDateTime(report._creationTime)}
                        >
                          {formatShortDate(report._creationTime)}
                        </time>
                      </TableCell>
                      {canUpdateFeedback ? (
                        <TableCell>
                          <div className="flex justify-end">
                            <FeedbackStatusActions report={report} reportMutation={reportMutation} />
                          </div>
                        </TableCell>
                      ) : null}
                      <TableCell>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-compact"
                          aria-label={`Details: feedback from ${displayName(report.submitter)}`}
                          onClick={() => setSelectedId(report._id)}
                        >
                          <ChevronRight />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={columns}>{empty}</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <div className="md:hidden">
            {isLoading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((index) => (
                  <Skeleton key={index} className="h-16 w-full" />
                ))}
              </div>
            ) : reports.length ? (
              <CardGroup orientation="inline" border="none" corners="compact">
                {reports.map((report) => (
                  <Card
                    key={report._id}
                    onClick={() => setSelectedId(report._id)}
                    selected={report._id === openId}
                    label={`Details: feedback from ${displayName(report.submitter)}`}
                  >
                    <CardHeader>
                      <CardTitle>
                        <span className="line-clamp-2">{report.reason}</span>
                      </CardTitle>
                      <CardDescription className="truncate">
                        {displayName(report.submitter)} · {formatShortDate(report._creationTime)}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                ))}
              </CardGroup>
            ) : (
              empty
            )}
          </div>
        </TabPanel>
      </DataTableSection>
      <FeedbackSheet
        report={selected}
        open={openId !== null}
        onClose={close}
        body={openId ? (drafts[openId] ?? '') : ''}
        onBodyChange={(body) => {
          if (openId) setDrafts((current) => ({ ...current, [openId]: body }));
        }}
        reportMutation={reportMutation}
        responseMutation={responseMutation}
        retryGithubIssueMutation={retryGithubIssueMutation}
        approveBugMutation={approveBugMutation}
        canApproveBugs={canApproveBugs}
        canUpdateFeedback={canUpdateFeedback}
      />
    </Tabs>
  );
}

type StatusAction = ReportStatusAction<FeedbackReport['status']>;

const START_REVIEW: StatusAction = { label: 'Start review', status: 'IN_REVIEW', icon: Eye };
const RESOLVE: StatusAction = { label: 'Resolve', status: 'RESOLVED', icon: CheckCircle2 };
const ARCHIVE: StatusAction = { label: 'Archive', status: 'DISMISSED', icon: Archive };
const MOVE_TO_NEW: StatusAction = { label: 'Move back to New', status: 'PENDING', icon: Inbox };
const REOPEN: StatusAction = { label: 'Reopen', status: 'IN_REVIEW', icon: Undo2 };

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
  const decided = report.status === 'RESOLVED' || report.status === 'DISMISSED';
  return (
    <ReportStatusActions
      {...STATUS_ACTIONS[report.status]}
      emphasis={decided ? 'secondary' : 'primary'}
      disabled={reportMutation.isPending}
      menuLabel={`feedback from ${displayName(report.submitter)}`}
      onRun={(action) =>
        reportMutation.mutate({
          id: report._id,
          status: action.status,
          expectedStatus: report.status,
          // The status speaks for itself; a note would only repeat it.
          reviewNote: '',
        })
      }
    />
  );
}

/** Only what differs between rows: attachments, replies, or a sync problem. */
function FeedbackRowMeta({ report }: { report: FeedbackReport }) {
  const syncFailed = report.githubIssueSyncState === 'FAILED';
  if (!report.images.length && !report.responses.length && !syncFailed) return null;
  return (
    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-muted-foreground">
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

/** Record detail in the audit log's anatomy: a side sheet opened from the row. */
function FeedbackSheet({
  report,
  open,
  onClose,
  ...detail
}: {
  report?: FeedbackReport;
  open: boolean;
  onClose: () => void;
} & Omit<FeedbackDetailProps, 'report'>) {
  const openerRef = useRef<HTMLElement | null>(null);
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        className="flex h-full w-full flex-col sm:max-w-xl"
        onOpenAutoFocus={() => {
          openerRef.current =
            document.activeElement instanceof HTMLElement ? document.activeElement : null;
        }}
        onCloseAutoFocus={(event) => {
          if (openerRef.current?.isConnected) {
            event.preventDefault();
            openerRef.current.focus();
          }
        }}
      >
        {report ? (
          <FeedbackDetail key={report._id} report={report} {...detail} />
        ) : (
          <>
            <SheetHeader>
              <SheetTitle>Feedback</SheetTitle>
              <SheetDescription className="sr-only">Feedback details</SheetDescription>
            </SheetHeader>
            <AdminNotice message="Loading feedback…" />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

type FeedbackDetailProps = {
  report: FeedbackReport;
  body: string;
  onBodyChange: (body: string) => void;
  reportMutation: FeedbackMutation;
  responseMutation: FeedbackResponseMutation;
  retryGithubIssueMutation: RetryGithubIssueMutation;
  approveBugMutation: ApproveBugMutation;
  canApproveBugs: boolean;
  canUpdateFeedback: boolean;
};

function FeedbackDetail({
  report,
  body,
  onBodyChange,
  reportMutation,
  responseMutation,
  retryGithubIssueMutation,
  approveBugMutation,
  canApproveBugs,
  canUpdateFeedback,
}: FeedbackDetailProps) {
  const [isSending, setIsSending] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const classifyBug = useMutation(api.moderation.bugRewards.setFeedbackKind);
  const revokeBug = useMutation(api.moderation.bugRewards.revoke);
  const { toast } = useToast();
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
          : 'Could not send the reply. Your draft is still here.',
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
      setError(cause instanceof Error ? cause.message : 'Could not retry GitHub sync.');
    } finally {
      setIsRetrying(false);
    }
  }

  const metadata = report.clientMetadata;

  return (
    <>
      <SheetHeader className="shrink-0">
        <div className="flex items-center gap-3 pr-8">
          <UserAvatar person={report.submitter} size={32} />
          <div className="min-w-0">
            <SheetTitle className="truncate">{displayName(report.submitter)}</SheetTitle>
            <SheetDescription className="text-xs">
              <time dateTime={new Date(report._creationTime).toISOString()}>
                {formatDateTime(report._creationTime)}
              </time>
              {report.appVersion ? ` · ${report.appVersion}` : ''}
            </SheetDescription>
          </div>
        </div>
      </SheetHeader>

      <div className="mt-4 flex shrink-0 items-center justify-between gap-3 border-y border-border/40 py-2.5">
        <ReportStatusBadge status={report.status} audience="feedback" />
        {canUpdateFeedback ? (
          <FeedbackStatusActions report={report} reportMutation={reportMutation} />
        ) : null}
      </div>
      {canApproveBugs ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor={`feedback-kind-${report._id}`} className="text-sm">Feedback type</label>
          <Select value={report.feedbackKind ?? 'OTHER'} disabled={isClassifying || Boolean(report.bugApprovedAt)} onValueChange={(value) => {
            setIsClassifying(true);
            void classifyBug({ reportId: report._id, feedbackKind: value as 'BUG' | 'OTHER' })
              .catch((error: unknown) => toast({ title: error instanceof Error ? error.message : 'Could not change feedback type', variant: 'destructive' }))
              .finally(() => setIsClassifying(false));
          }}>
            <SelectTrigger id={`feedback-kind-${report._id}`} placeholder="Feedback type" />
            <SelectContent><SelectItem value="OTHER" index={0}>Idea or other</SelectItem><SelectItem value="BUG" index={1}>Bug report</SelectItem></SelectContent>
          </Select>
          {report.bugApprovedAt ? (
            <Button type="button" size="sm" variant="secondary" disabled={isApproving} onClick={() => {
              if (!window.confirm('Revoke this bug credit from the student?')) return;
              setIsApproving(true);
              void revokeBug({ reportId: report._id })
                .then(() => toast({ title: 'Bug credit revoked' }))
                .catch((error: unknown) => toast({ title: error instanceof Error ? error.message : 'Could not revoke credit', variant: 'destructive' }))
                .finally(() => setIsApproving(false));
            }}>Revoke credit</Button>
          ) : null}
        </div>
      ) : null}
      {canApproveBugs && report.feedbackKind === 'BUG' && !report.bugApprovedAt && report.status !== 'DISMISSED' ? (
        <Button type="button" size="sm" variant="secondary" className="mt-3 self-start" disabled={isApproving || reportMutation.isPending} onClick={() => {
          if (isApproving || !window.confirm('Confirm this report describes a real bug? This awards the student a Bug Hunter credit.')) return;
          setIsApproving(true);
          void approveBugMutation(report._id).finally(() => setIsApproving(false));
        }}>{isApproving ? 'Approving…' : 'Approve confirmed bug'}</Button>
      ) : null}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex min-w-0 flex-col gap-5 py-5 [overflow-wrap:anywhere]">
          <div className="flex flex-col gap-3">
            <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
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
            {report.githubIssueUrl ? (
              <a
                href={report.githubIssueUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex w-fit items-center gap-1.5 rounded-sm text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Github className="size-3.5" aria-hidden />
                Issue #{report.githubIssueNumber}
                <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : report.githubIssueSyncState && canRetryGithubSync(report, openedAt) ? (
              <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <TriangleAlert className="size-3.5 text-amber-500" aria-hidden />
                {report.githubIssueSyncState === 'FAILED' ? 'Not on GitHub yet' : 'GitHub sync stalled'}
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
              </p>
            ) : null}
          </div>

          {report.responses.length || canUpdateFeedback || error ? (
            <section aria-label="Staff replies" className="flex flex-col gap-4 border-t border-border/40 pt-5">
              {report.responses.map((response) => (
                <div key={response._id} className="flex gap-3">
                  <MessageSquare className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{displayName(response.author)}</span>
                      {' · '}
                      {formatDateTime(response.createdAt)}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{response.body}</p>
                  </div>
                </div>
              ))}
              {canUpdateFeedback ? (
                <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                  <Textarea
                    aria-label={`Reply to ${displayName(report.submitter)}`}
                    aria-describedby={`feedback-reply-help-${report._id}`}
                    placeholder={`Reply to ${displayName(report.submitter)}…`}
                    value={body}
                    onChange={(event) => onBodyChange(event.target.value)}
                    maxLength={1_000}
                    rows={3}
                    disabled={isSending}
                  />
                  {error ? (
                    <p role="alert" className="text-xs text-destructive">
                      {error}
                    </p>
                  ) : null}
                  <div className="flex items-center justify-between gap-3">
                    <p id={`feedback-reply-help-${report._id}`} className="text-xs text-muted-foreground">
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

          {metadata ? (
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="technical">
                <AccordionTrigger>Technical details</AccordionTrigger>
                <AccordionContent>
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-muted-foreground">Browser</dt>
                    <dd>{metadata.userAgent}</dd>
                    <dt className="text-muted-foreground">Display</dt>
                    <dd>
                      {metadata.viewportWidth}×{metadata.viewportHeight} viewport ·{' '}
                      {metadata.screenWidth}×{metadata.screenHeight} screen · {metadata.pixelRatio}× ·{' '}
                      {metadata.displayMode}
                    </dd>
                    <dt className="text-muted-foreground">Locale</dt>
                    <dd>
                      {metadata.language} · {metadata.timezone}
                    </dd>
                  </dl>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          ) : null}
        </div>
      </ScrollArea>
    </>
  );
}
