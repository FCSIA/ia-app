'use client';

import { useState } from 'react';
import { Archive, Inbox, CheckCircle2, ExternalLink } from 'lucide-react';
import { displayName } from '~/apps/shared/user-name';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import {
  DataTablePanel,
  dataTableClasses,
} from '@/components/data/data-table-panel';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  const [view, setView] = useState('active');
  // Keep response drafts in the queue so closing a detail dialog or changing
  // the queue filter does not discard a message the administrator is writing.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const byStatus = {
    active: filteredReports.filter((report) => report.status === 'PENDING'),
    resolved: filteredReports.filter((report) => report.status === 'RESOLVED'),
    archive: filteredReports.filter((report) => report.status === 'DISMISSED'),
  };
  const reports = byStatus[view as keyof typeof byStatus];
  const classes = dataTableClasses();

  return (
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
              value="active"
              label={`Active ${byStatus.active.length}`}
              icon={Inbox}
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
                      <div className="flex gap-2">
                        <FeedbackDetail
                          report={report}
                          body={drafts[report._id] ?? ''}
                          onBodyChange={(body) =>
                            setDrafts((current) => ({
                              ...current,
                              [report._id]: body,
                            }))
                          }
                          responseMutation={responseMutation}
                          retryGithubIssueMutation={retryGithubIssueMutation}
                          canUpdateFeedback={canUpdateFeedback}
                        />
                        {canUpdateFeedback && report.status === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              disabled={reportMutation.isPending}
                              onClick={() =>
                                reportMutation.mutate({
                                  id: report._id,
                                  status: 'RESOLVED',
                                  reviewNote: 'Reviewed',
                                })
                              }
                            >
                              Resolve
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              disabled={reportMutation.isPending}
                              onClick={() =>
                                reportMutation.mutate({
                                  id: report._id,
                                  status: 'DISMISSED',
                                  reviewNote: 'Dismissed',
                                })
                              }
                            >
                              Archive
                            </Button>
                          </>
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
  );
}

function FeedbackDetail({
  report,
  body,
  onBodyChange,
  responseMutation,
  retryGithubIssueMutation,
  canUpdateFeedback,
}: {
  report: FeedbackReport;
  body: string;
  onBodyChange: (body: string) => void;
  responseMutation: FeedbackResponseMutation;
  retryGithubIssueMutation: RetryGithubIssueMutation;
  canUpdateFeedback: boolean;
}) {
  const [isSending, setIsSending] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [error, setError] = useState<string>();

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
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm" variant="tertiary">
          Details
        </Button>
      </DialogTrigger>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>
            Feedback from {displayName(report.submitter)}
          </DialogTitle>
          <DialogDescription>
            Submitted {formatDateTime(report._creationTime)}
            {report.appVersion ? ` · ${report.appVersion}` : ''}
          </DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-wrap break-words text-sm text-foreground">
          {report.reason}
        </p>
        {report.githubIssueUrl ? (
          <Button
            asChild
            size="sm"
            variant="tertiary"
            trailingIcon={ExternalLink}
          >
            <a href={report.githubIssueUrl} target="_blank" rel="noreferrer">
              GitHub issue #{report.githubIssueNumber}
            </a>
          </Button>
        ) : null}
        {report.githubIssueSyncState === 'FAILED' ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-destructive">
              GitHub sync failed. This feedback is still saved.
            </p>
            {canUpdateFeedback ? (
              <Button
                size="sm"
                variant="tertiary"
                loading={isRetrying}
                onClick={() => void retrySync()}
              >
                Retry sync
              </Button>
            ) : null}
          </div>
        ) : null}
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
                  <img
                    src={image.url}
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
        <div className="space-y-4">
          {report.responses.map((response) => (
            <div key={response._id}>
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
            <form
              className="space-y-3 border-t border-border/40 pt-4"
              onSubmit={handleSubmit}
            >
              <Textarea
                aria-label={`Respond to feedback from ${displayName(report.submitter)}`}
                placeholder="Write a response for the submitter…"
                value={body}
                onChange={(event) => onBodyChange(event.target.value)}
                maxLength={1_000}
                rows={3}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">
                The submitter can read this response but cannot reply. Closing
                this dialog keeps your draft.
              </p>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                size="sm"
                loading={isSending}
                disabled={!body.trim() || isSending}
              >
                Send response
              </Button>
            </form>
          ) : error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
