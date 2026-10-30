'use client';

import { FeedbackTab } from '../feedback-tab';
import { useAdminFeedback } from '../../_hooks/use-admin-feedback';

export function FeedbackTabPanel({ canUpdateFeedback = true }: { canUpdateFeedback?: boolean }) {
  const feedback = useAdminFeedback('feedback');

  return (
    <FeedbackTab
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
  );
}
