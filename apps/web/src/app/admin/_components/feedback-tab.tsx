'use client';

import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { SearchInput } from '@/components/ui/search';
import { AdminNotice, AdminPanel } from './admin-ui';

type FeedbackReport = Doc<'moderationReports'> & {
  submitter: { firstName: string; lastName: string } | null;
  images: Array<{ _id: Id<'feedbackReportImages'>; url: string }>;
};
type FeedbackStatus = FeedbackReport['status'];

type FeedbackMutation = {
  mutate: (args: { id: Id<'moderationReports'>; status: FeedbackStatus; reviewNote: string }) => void;
  isPending: boolean;
};

export function FeedbackTab({
  feedbackSearch,
  onFeedbackSearchChange,
  deferredFeedbackSearch,
  filteredReports,
  reportMutation,
}: {
  feedbackSearch: string;
  onFeedbackSearchChange: (value: string) => void;
  deferredFeedbackSearch: string;
  filteredReports: FeedbackReport[];
  reportMutation: FeedbackMutation;
}) {
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
      {filteredReports.length === 0 ? (
        <AdminNotice
          message={deferredFeedbackSearch ? 'No feedback matches your search.' : 'No feedback submitted.'}
          actionLabel={deferredFeedbackSearch ? 'Clear search' : undefined}
          onAction={deferredFeedbackSearch ? () => onFeedbackSearchChange('') : undefined}
        />
      ) : (
        <div className="divide-y rounded-lg border">
          {filteredReports.map((report) => (
            <div key={report._id} className="p-3 transition-colors hover:bg-muted/30">
              <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
                <div className="min-w-0">
                  <Badge
                    size="sm"
                    variant="solid"
                    color={report.status === 'PENDING' ? 'amber' : report.status === 'RESOLVED' ? 'emerald' : 'gray'}
                  >
                    {report.status}
                  </Badge>
                  <p className="mt-2 text-sm font-medium text-foreground">{report.reason}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    By {report.submitter?.firstName} {report.submitter?.lastName}
                  </p>
                  {report.images.length > 0 ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {report.images.map((image, index) => (
                        <a
                          key={image._id}
                          href={image.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block size-20 overflow-hidden rounded-md border bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                </div>
                {report.status === 'PENDING' ? (
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
                      Dismiss
                    </Button>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminPanel>
  );
}
