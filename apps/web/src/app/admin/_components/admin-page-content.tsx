'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { AdminPageLayout } from './admin-page-layout';
import { AdminShell } from './admin-shell';
import { AdminFillTabPanel, AdminScrollTabPanel } from './admin-tab-panel';
import { AuditTabPanel } from './panels/audit-tab-panel';
import { FeedbackTabPanel } from './panels/feedback-tab-panel';
import { ModerationTabPanel } from './panels/moderation-tab-panel';
import { AdministratorRosterTabPanel } from './panels/administrator-roster-tab-panel';
import { ScheduleTabPanel } from './panels/schedule-tab-panel';
import { UsersTabPanel } from './panels/users-tab-panel';
import { WrappedTabPanel } from './panels/wrapped-tab-panel';
import { useAdminModerationPending } from '../_hooks/use-admin-moderation-pending';
import { useAdminTab } from '../_hooks/use-admin-tab';

export function AdminPageContent() {
  const user = useCurrentUser();
  const router = useRouter();
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const canReviewFeedback = isSuperAdmin || user?.canReviewFeedback === true;
  const canManageWrapped = hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const hasAdministrativeAccess = hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF');

  const { activeTab, setActiveTab } = useAdminTab(isSuperAdmin, canManageWrapped);
  const pendingReports = useAdminModerationPending();

  useEffect(() => {
    if (user && !hasAdministrativeAccess && !canReviewFeedback) {
      router.replace('/dashboard');
    }
  }, [canReviewFeedback, hasAdministrativeAccess, user, router]);

  if (!hasAdministrativeAccess && canReviewFeedback) {
    return (
      <AdminPageLayout>
        <FeedbackTabPanel canUpdateFeedback={false} />
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout>
      <AdminShell
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSuperAdmin={isSuperAdmin}
        canManageWrapped={canManageWrapped}
        pendingReports={pendingReports}
      >
        <AdminFillTabPanel value="users">
          {activeTab === 'users' ? <UsersTabPanel /> : null}
        </AdminFillTabPanel>

        {isSuperAdmin ? (
          <AdminScrollTabPanel value="schedule">
            {activeTab === 'schedule' ? <ScheduleTabPanel /> : null}
          </AdminScrollTabPanel>
        ) : null}

        {isSuperAdmin ? (
          <AdminScrollTabPanel value="administrator-roster">
            {activeTab === 'administrator-roster' ? <AdministratorRosterTabPanel /> : null}
          </AdminScrollTabPanel>
        ) : null}

        <AdminScrollTabPanel value="moderation">
          {activeTab === 'moderation' ? <ModerationTabPanel /> : null}
        </AdminScrollTabPanel>

        {canReviewFeedback ? (
          <AdminScrollTabPanel value="feedback">
            {activeTab === 'feedback' ? <FeedbackTabPanel /> : null}
          </AdminScrollTabPanel>
        ) : null}

        {canManageWrapped ? (
          <AdminScrollTabPanel value="wrapped">
            {activeTab === 'wrapped' ? <WrappedTabPanel canManageWrapped={canManageWrapped} /> : null}
          </AdminScrollTabPanel>
        ) : null}

        <AdminScrollTabPanel value="audit">
          {activeTab === 'audit' ? <AuditTabPanel /> : null}
        </AdminScrollTabPanel>
      </AdminShell>
    </AdminPageLayout>
  );
}
