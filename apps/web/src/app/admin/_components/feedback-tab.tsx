'use client';

import { displayName } from '~/apps/shared/user-name';

import { useState } from 'react';
import { Archive, Inbox, CheckCircle2 } from 'lucide-react';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardGroup } from '@/components/ui/card';
import { SearchInput } from '@/components/ui/search';
import { TabItem, TabPanel, Tabs, TabsList } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { formatDateTime } from '../_lib/admin-utils';
import { AdminNotice, AdminPanel } from './admin-ui';

type FeedbackReport = Doc<'moderationReports'> & {
  submitter: { firstName: string; lastName: string; preferredName?: string | null } | null;
  images: Array<{ _id: Id<'feedbackReportImages'>; url: string }>;
  responses: Array<{
    _id: Id<'feedbackReportResponses'>;
    body: string;
    createdAt: number;
    author: { firstName: string; lastName: string; preferredName?: string | null };
  }>;
};
type FeedbackStatus = FeedbackReport['status'];

type FeedbackMutation = {
  mutate: (args: { id: Id<'moderationReports'>; status: FeedbackStatus; reviewNote: string }) => void;
  isPending: boolean;
};

type FeedbackResponseMutation = (args: {
  reportId: Id<'moderationReports'>;
  body: string;
}) => Promise<void>;

export function FeedbackTab({
  feedbackSearch,
  onFeedbackSearchChange,
  deferredFeedbackSearch,
  filteredReports,
  reportMutation,
  responseMutation,
  canUpdateFeedback = true,
}: {
  feedbackSearch: string;
  onFeedbackSearchChange: (value: string) => void;
  deferredFeedbackSearch: string;
  filteredReports: FeedbackReport[];
  reportMutation: FeedbackMutation;
  responseMutation: FeedbackResponseMutation;
  canUpdateFeedback?: boolean;
}) {
  const [view, setView] = useState<'active' | 'resolved' | 'archive'>('active');
  const activeReports = filteredReports.filter((report) => report.status === 'PENDING');
  const resolvedReports = filteredReports.filter((report) => report.status === 'RESOLVED');
  const archivedReports = filteredReports.filter((report) => report.status === 'DISMISSED');

  return (
    <AdminPanel
      title="Feedback"
      actions={
        <SearchInput
          className="w-full sm:w-72"
          value={feedbackSearch}
          onValueChange={onFeedbackSearchChange}
          placeholder="Search feedback..."
          size="sm"
        />
      }
      contentClassName="space-y-3"
    >
      <Tabs value={view} onValueChange={(value) => setView(value as 'active' | 'resolved' | 'archive')}>
        <TabsList aria-label="Feedback views">
          <TabItem value="active" label={`Active ${activeReports.length}`} icon={Inbox} />
          <TabItem value="resolved" label={`Resolved ${resolvedReports.length}`} icon={CheckCircle2} />
          <TabItem value="archive" label={`Archive ${archivedReports.length}`} icon={Archive} />
        </TabsList>

        <TabPanel value="active" className="mt-3">
          <FeedbackList
            reports={activeReports}
            emptyMessage={deferredFeedbackSearch ? 'No active feedback matches your search.' : 'No active feedback submitted.'}
            clearSearch={deferredFeedbackSearch ? () => onFeedbackSearchChange('') : undefined}
            reportMutation={reportMutation}
            responseMutation={responseMutation}
            canUpdateFeedback={canUpdateFeedback}
          />
        </TabPanel>
        <TabPanel value="resolved" className="mt-3">
          <FeedbackList
            reports={resolvedReports}
            emptyMessage={deferredFeedbackSearch ? 'No resolved feedback matches your search.' : 'No resolved feedback.'}
            clearSearch={deferredFeedbackSearch ? () => onFeedbackSearchChange('') : undefined}
            reportMutation={reportMutation}
            responseMutation={responseMutation}
            canUpdateFeedback={canUpdateFeedback}
          />
        </TabPanel>
        <TabPanel value="archive" className="mt-3">
          <FeedbackList
            reports={archivedReports}
            emptyMessage={deferredFeedbackSearch ? 'No archived feedback matches your search.' : 'No archived feedback.'}
            clearSearch={deferredFeedbackSearch ? () => onFeedbackSearchChange('') : undefined}
            reportMutation={reportMutation}
            responseMutation={responseMutation}
            canUpdateFeedback={canUpdateFeedback}
          />
        </TabPanel>
      </Tabs>
    </AdminPanel>
  );
}

function FeedbackList({
  reports,
  emptyMessage,
  clearSearch,
  reportMutation,
  responseMutation,
  canUpdateFeedback,
}: {
  reports: FeedbackReport[];
  emptyMessage: string;
  clearSearch?: () => void;
  reportMutation: FeedbackMutation;
  responseMutation: FeedbackResponseMutation;
  canUpdateFeedback: boolean;
}) {
  if (reports.length === 0) {
    return (
      <AdminNotice
        message={emptyMessage}
        actionLabel={clearSearch ? 'Clear search' : undefined}
        onAction={clearSearch}
      />
    );
  }

  return (
    <CardGroup border="outlined" className="overflow-hidden divide-y divide-border/40">
      {reports.map((report) => (
        <Card key={report._id} className="p-4 transition-colors hover:bg-muted/30">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <Badge
                  size="sm"
                  variant="solid"
                  color={report.status === 'PENDING' ? 'amber' : report.status === 'RESOLVED' ? 'emerald' : 'gray'}
                >
                  {report.status}
                </Badge>
                <p className="text-sm font-medium text-foreground">{report.reason}</p>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                By {displayName(report.submitter)}
                {' · '}
                Submitted {formatDateTime(report._creationTime)}
                {report.appVersion ? ` · ${report.appVersion}` : ''}
              </p>
              {report.images.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.images.map((image, index) => (
                    <a
                      key={image._id}
                      href={image.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block size-20 overflow-hidden rounded-lg border border-border/40 bg-muted transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <img
                        src={image.url}
                        alt={`Feedback attachment ${index + 1}`}
                        className="size-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : null}
              {canUpdateFeedback ? (
                <FeedbackResponses report={report} responseMutation={responseMutation} />
              ) : null}
            </div>
            {canUpdateFeedback && report.status === 'PENDING' ? (
              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  loading={reportMutation.isPending}
                  onClick={() => reportMutation.mutate({ id: report._id, status: 'RESOLVED', reviewNote: 'Reviewed' })}
                >
                  Resolve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={reportMutation.isPending}
                  onClick={() => reportMutation.mutate({ id: report._id, status: 'DISMISSED', reviewNote: 'Dismissed' })}
                >
                  Dismiss & archive
                </Button>
              </div>
            ) : null}
          </div>
        </Card>
      ))}
    </CardGroup>
  );
}

function FeedbackResponses({
  report,
  responseMutation,
}: {
  report: FeedbackReport;
  responseMutation: FeedbackResponseMutation;
}) {
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const trimmedBody = body.trim();

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!trimmedBody || isSending) return;

    setIsSending(true);
    try {
      await responseMutation({ reportId: report._id, body: trimmedBody });
      setBody('');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <CardGroup border="outlined" className="mt-4 overflow-hidden bg-muted/20 rounded-xl">
      <Card className="p-4">
        <div className="space-y-3">
          {report.responses.map((response) => (
            <div key={response._id} className="rounded-lg bg-background p-3 border border-border/40">
              <p className="text-xs font-medium text-muted-foreground">
                {displayName(response.author)}
              </p>
              <p className="mt-1 whitespace-pre-wrap text-foreground">{response.body}</p>
            </div>
          ))}
          <form className="space-y-3 pt-3 border-t border-border/40" onSubmit={handleSubmit}>
            <Textarea
              aria-label={`Respond to feedback from ${displayName(report.submitter) || 'submitter'}`}
              placeholder="Write a response for the submitter..."
              value={body}
              onChange={(event) => setBody(event.target.value)}
              maxLength={1_000}
              rows={3}
              disabled={isSending}
              className="border-border/60 focus:border-primary focus:ring-primary/20"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">The submitter can read this response but cannot reply.</p>
              <Button type="submit" size="sm" loading={isSending} disabled={!trimmedBody}>
                Send response
              </Button>
            </div>
          </form>
        </div>
      </Card>
    </CardGroup>
  );
}
