'use client';

import { FeedbackTab } from '../feedback-tab';
import { useAdminFeedback } from '../../_hooks/use-admin-feedback';
import { useCurrentUser } from '@/lib/auth';

export function FeedbackTabPanel({ canUpdateFeedback = true }: { canUpdateFeedback?: boolean }) {
  const feedback = useAdminFeedback('feedback');
  const user = useCurrentUser();

  return (
    <FeedbackTab
      feedbackSearch={feedback.feedbackSearch}
      onFeedbackSearchChange={feedback.setFeedbackSearch}
      deferredFeedbackSearch={feedback.deferredFeedbackSearch}
      filteredReports={feedback.filteredReports}
      reportMutation={feedback.reportMutation}
      responseMutation={feedback.responseMutation}
      retryGithubIssueMutation={feedback.retryGithubIssueMutation}
      approveBugMutation={feedback.approveBugMutation}
      canApproveBugs={Boolean(user?.isDeveloper && (user.roles.includes('SUPER_ADMIN') || user.canReviewFeedback))}
      canUpdateFeedback={canUpdateFeedback}
    />
  );
}
