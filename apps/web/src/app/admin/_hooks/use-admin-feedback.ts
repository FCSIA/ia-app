'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Doc, Id } from '~/apps/convex/src/_generated/dataModel';
import { useToast } from '@/hooks/use-toast';
import type { AdminTabId } from './use-admin-tab';

export function useAdminFeedback(activeTab: AdminTabId) {
  const { toast } = useToast();
  const [updating, setUpdating] = useState(false);
  const [feedbackSearch, setFeedbackSearch] = useState('');
  const deferredFeedbackSearch = useDeferredValue(feedbackSearch);
  const reportResult = useQuery(api.moderation.reports.listFeedback, activeTab === 'feedback' ? {} : 'skip');
  const reports = useMemo(() => reportResult ?? [], [reportResult]);
  const updateReport = useMutation(api.moderation.reports.update);
  const addFeedbackResponse = useMutation(api.moderation.reports.addFeedbackResponse);
  const retryGithubIssueSync = useMutation(api.moderation.reports.retryGithubIssueSync);

  const filteredReports = useMemo(() => {
    const query = deferredFeedbackSearch.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((report) => {
      const searchable = [
        report.reason,
        report.submitter?.firstName,
        report.submitter?.lastName,
        report.submitter?.preferredName,
        report.status,
        ...report.responses.map((response) => response.body),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return searchable.includes(query);
    });
  }, [reports, deferredFeedbackSearch]);

  const reportMutation = {
    mutate: ({
      id,
      status,
      reviewNote,
    }: {
      id: Id<'moderationReports'>;
      status: Doc<'moderationReports'>['status'];
      reviewNote: string;
    }) => {
      if (updating) return;
      setUpdating(true);
      void updateReport({
        reportId: id,
        status,
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
