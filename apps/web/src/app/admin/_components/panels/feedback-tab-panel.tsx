'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import { AdminNotice } from '../admin-ui';
import { FeedbackTab } from '../feedback-tab';
import { useAdminFeedback } from '../../_hooks/use-admin-feedback';

export function FeedbackTabPanel({ canUpdateFeedback = true }: { canUpdateFeedback?: boolean }) {
  const feedback = useAdminFeedback('feedback');
  const reportId = useParams<{ reportId?: string }>()?.reportId;
  const router = useRouter();
  const focusedReport = useQuery(api.moderation.reports.getFeedback, reportId ? { reportId } : 'skip');

  return (
    <>
      {reportId && focusedReport === undefined ? <AdminNotice message="Loading feedback report…" /> : null}
      {reportId && focusedReport === null ? <AdminNotice message="Feedback report unavailable." /> : null}
      <FeedbackTab
        focusedReport={focusedReport ?? undefined}
        onFocusedReportClose={() => router.replace('/admin/feedback')}
        isLoading={feedback.isLoading}
        feedbackSearch={feedback.feedbackSearch}
        onFeedbackSearchChange={feedback.setFeedbackSearch}
        deferredFeedbackSearch={feedback.deferredFeedbackSearch}
        filteredReports={feedback.filteredReports}
        reportMutation={feedback.reportMutation}
        responseMutation={feedback.responseMutation}
        retryGithubIssueMutation={feedback.retryGithubIssueMutation}
        canUpdateFeedback={canUpdateFeedback}
      />
    </>
  );
}
