'use client';

import { ModerationTab } from '../moderation-tab';
import { useAdminModeration } from '../../_hooks/use-admin-moderation';
import { useAdminModerationPending } from '../../_hooks/use-admin-moderation-pending';

export function ModerationTabPanel() {
  const moderation = useAdminModeration('moderation');
  const pendingReports = useAdminModerationPending();

  return (
    <ModerationTab
      isLoading={moderation.isLoading}
      isKeywordsLoading={moderation.isKeywordsLoading}
      keyword={moderation.keyword}
      onKeywordChange={moderation.setKeyword}
      keywords={moderation.keywords}
      addKeywordMutation={moderation.addKeywordMutation}
      removeKeywordMutation={moderation.removeKeywordMutation}
      moderationSearch={moderation.moderationSearch}
      onModerationSearchChange={moderation.setModerationSearch}
      deferredModerationSearch={moderation.deferredModerationSearch}
      filteredReports={moderation.filteredReports}
      pendingReports={pendingReports}
      reportMutation={moderation.reportMutation}
    />
  );
}
