'use client';

import { FeedbackTab } from '../feedback-tab';
import { useAdminFeedback } from '../../_hooks/use-admin-feedback';

export function FeedbackTabPanel() {
  const feedback = useAdminFeedback('feedback');

  return (
    <FeedbackTab
      feedbackSearch={feedback.feedbackSearch}
      onFeedbackSearchChange={feedback.setFeedbackSearch}
      deferredFeedbackSearch={feedback.deferredFeedbackSearch}
      filteredReports={feedback.filteredReports}
      reportMutation={feedback.reportMutation}
      responseMutation={feedback.responseMutation}
    />
  );
}
