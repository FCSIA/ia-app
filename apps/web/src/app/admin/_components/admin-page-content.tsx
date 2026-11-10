'use client';

import {
  hasAnyRole,
  isAdmin,
  isStaff,
  SUPER_ADMIN_ROLES,
} from '~/apps/shared/roles';
import { useEffect, type ComponentType } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCurrentUser } from '@/lib/auth';
import { AdminPageLayout } from './admin-page-layout';
import { AdminMobileNavigation, AdminShell } from './admin-shell';
import { AdminScrollTabPanel } from './admin-tab-panel';
import { AdministratorRosterTab } from './administrator-roster-tab';
import { AnalyticsTab } from './analytics/analytics-tab';
import { AuditTab } from './audit/audit-tab';
import { FeedbackTab } from './feedback-tab';
import { ModerationTab } from './moderation-tab';
import { AdminScheduleTab } from './schedule-tab';
import { AdminUsersTab } from './users/users-tab';
import { WrappedSnapshotsTab } from './wrapped-snapshots-tab';
import { useAdminModerationPending } from '../_hooks/use-admin-moderation-pending';
import { useAdminTab } from '../_hooks/use-admin-tab';
import { visibleAdminSections, type AdminTabId } from '../_lib/admin-sections';

const SECTION_CONTENT: Record<AdminTabId, ComponentType> = {
  users: AdminUsersTab,
  schedule: AdminScheduleTab,
  'administrator-roster': AdministratorRosterTab,
  moderation: ModerationTab,
  feedback: FeedbackTab,
  wrapped: WrappedSnapshotsTab,
  analytics: AnalyticsTab,
  audit: AuditTab,
};

export function AdminPageContent() {
  const user = useCurrentUser();
  const router = useRouter();
  const reportId = useParams<{ reportId?: string }>()?.reportId;
  const isSuperAdmin = hasAnyRole(user, SUPER_ADMIN_ROLES);
  const canReviewFeedback = isSuperAdmin || user?.canReviewFeedback === true;
  const access = { isSuperAdmin, canManageWrapped: isAdmin(user) };
  const hasAdministrativeAccess = isStaff(user);

  const activeTab = useAdminTab(access);
  const pendingReports = useAdminModerationPending();

  useEffect(() => {
    if (user && !hasAdministrativeAccess && !canReviewFeedback) {
      router.replace('/');
    }
  }, [canReviewFeedback, hasAdministrativeAccess, user, router]);

  if (canReviewFeedback && !isSuperAdmin && (reportId || !hasAdministrativeAccess)) {
    return (
      <AdminPageLayout>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col p-4 md:p-6 lg:p-8">
          <FeedbackTab canUpdateFeedback={false} />
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      headerNavigation={
        <AdminMobileNavigation activeTab={activeTab} access={access} pendingReports={pendingReports} />
      }
    >
      <AdminShell activeTab={activeTab} access={access} pendingReports={pendingReports}>
        {visibleAdminSections(access).map(({ id }) => {
          const Content = SECTION_CONTENT[id];
          return (
            <AdminScrollTabPanel key={id} value={id}>
              {activeTab === id ? <Content /> : null}
            </AdminScrollTabPanel>
          );
        })}
      </AdminShell>
    </AdminPageLayout>
  );
}
