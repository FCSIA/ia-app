'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';
import { filterBySearchQuery } from '@/lib/search';
import { nameSearchValues } from '~/apps/shared/user-name';
import { STAFF_FEEDBACK_STATUS_LABELS } from '~/apps/shared/feedback-status';

export function useAdminFeedback() {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const deferredFeedbackSearch = useDeferredValue(feedbackSearch);
  const reportResult = useQuery(api.moderation.reports.listFeedback, {});
  const reports = useMemo(() => reportResult ?? [], [reportResult]);
  const updateReport = useMutation(api.moderation.reports.update);
  const addFeedbackResponse = useMutation(api.moderation.reports.addFeedbackResponse);
  const retryGithubIssueSync = useMutation(api.moderation.reports.retryGithubIssueSync);

  const filteredReports = useMemo(
    () =>
      filterBySearchQuery(reports, deferredFeedbackSearch, (report) => [
        report.reason,
        ...nameSearchValues(report.submitter),
        STAFF_FEEDBACK_STATUS_LABELS[report.status],
        ...report.responses.map((response) => response.body),
      ]),
    [reports, deferredFeedbackSearch],
  );

  const reportMutation = {
    mutate: ({
      id,
      status,
      expectedStatus,
      reviewNote,
    }: {
      id: Id<'moderationReports'>;
      status: Doc<'moderationReports'>['status'];
      expectedStatus: Doc<'moderationReports'>['status'];
      reviewNote: string;
    }) => {
      if (updating) return;
      setUpdating(true);
      void updateReport({
        reportId: id,
        status,
        expectedStatus,
        reviewNote,
      })
        .then(() => toast({ title: 'Feedback updated' }))
        .catch((error: unknown) =>
          toast({
            title: error instanceof Error ? error.message : 'Failed to update feedback',
            variant: 'destructive',
          }),
        )
        .finally(() => setUpdating(false));
    },
    isPending: updating,
  };

  async function responseMutation({ reportId, body }: { reportId: Id<'moderationReports'>; body: string }) {
    try {
      await addFeedbackResponse({ reportId, body });
      toast({ title: 'Response sent' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Failed to send response',
        variant: 'destructive',
      });
      throw error;
    }
  }

  async function retryGithubIssueMutation(reportId: Id<'moderationReports'>) {
    try {
      await retryGithubIssueSync({ reportId });
      toast({ title: 'GitHub issue retry queued' });
    } catch (error) {
      toast({
        title: error instanceof Error ? error.message : 'Unable to retry GitHub issue sync',
        variant: 'destructive',
      });
      throw error;
    }
  }

  return {
    isLoading: reportResult === undefined,
    feedbackSearch,
    setFeedbackSearch,
    deferredFeedbackSearch,
    filteredReports,
    reportMutation,
    responseMutation,
    retryGithubIssueMutation,
  };
}
