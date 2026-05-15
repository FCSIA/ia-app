'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { AdminPageLayout } from './admin-page-layout';
import { AdminShell } from './admin-shell';
import { AdminFillTabPanel, AdminScrollTabPanel } from './admin-tab-panel';
import { AuditTabPanel } from './panels/audit-tab-panel';
import { ModerationTabPanel } from './panels/moderation-tab-panel';
import { PermissionsTabPanel } from './panels/permissions-tab-panel';
import { ScheduleTabPanel } from './panels/schedule-tab-panel';
import { StudentAdminsTabPanel } from './panels/student-admins-tab-panel';
import { UsersTabPanel } from './panels/users-tab-panel';
import { WrappedTabPanel } from './panels/wrapped-tab-panel';
import { useAdminModerationPending } from '../_hooks/use-admin-moderation-pending';
import { useAdminTab } from '../_hooks/use-admin-tab';

export function AdminPageContent() {
  const user = useCurrentUser();
  const router = useRouter();
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const canManageWrapped = hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  const { activeTab, setActiveTab, isUsersTab } = useAdminTab(isSuperAdmin, canManageWrapped);
  const pendingReports = useAdminModerationPending();

  useEffect(() => {
    if (user && !hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const layout = isUsersTab ? 'fill' : 'scroll';

  return (
    <AdminPageLayout layout={layout}>
      <AdminShell
        layout={layout}
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

        <AdminScrollTabPanel value="moderation">
          {activeTab === 'moderation' ? <ModerationTabPanel /> : null}
        </AdminScrollTabPanel>

        <AdminScrollTabPanel value="permissions">
          {activeTab === 'permissions' ? <PermissionsTabPanel /> : null}
        </AdminScrollTabPanel>

        <AdminScrollTabPanel value="student-admins">
          {activeTab === 'student-admins' ? <StudentAdminsTabPanel /> : null}
        </AdminScrollTabPanel>

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
