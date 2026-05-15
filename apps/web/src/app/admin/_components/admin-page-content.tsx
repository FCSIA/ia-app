'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { FillPageLayout } from '@/components/layout/fill-page-layout';
import { ScrollPageLayout } from '@/components/layout/scroll-page-layout';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { AdminShell } from './admin-shell';
import { AdminFillTabPanel, AdminScrollTabPanel } from './admin-tab-panel';
import { AuditTab } from './audit/audit-tab';
import { ModerationTab } from './moderation-tab';
import { PermissionsTab, StudentAdminsTab } from './permissions-tab';
import { AdminScheduleTab } from './schedule-tab';
import { AdminUsersTab, UsersPaginationControls } from './users/users-tab';
import { WrappedSnapshotsTab } from './wrapped-snapshots-tab';
import { useAdminModeration } from '../_hooks/use-admin-moderation';
import { useAdminPermissions } from '../_hooks/use-admin-permissions';
import { useAdminScheduleImport } from '../_hooks/use-admin-schedule-import';
import { useAdminTab } from '../_hooks/use-admin-tab';
import { useAdminUsers } from '../_hooks/use-admin-users';
import { useAdminWrapped } from '../_hooks/use-admin-wrapped';

export function AdminPageContent() {
  const user = useCurrentUser();
  const router = useRouter();
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const canManageWrapped = hasRole(user, 'ADMIN', 'SUPER_ADMIN');

  const { activeTab, setActiveTab, isUsersTab } = useAdminTab(isSuperAdmin, canManageWrapped);
  const users = useAdminUsers(activeTab);
  const moderation = useAdminModeration(activeTab);
  const permissions = useAdminPermissions(activeTab);
  const schedule = useAdminScheduleImport(activeTab);
  const wrapped = useAdminWrapped(activeTab, canManageWrapped);

  useEffect(() => {
    if (user && !hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  const usersPagination =
    users.usersData?.total ? (
      <UsersPaginationControls
        page={users.page}
        total={users.usersData.total}
        pageSize={users.usersPageSize}
        onPrev={() => users.setPage((p) => p - 1)}
        onNext={() => users.setPage((p) => p + 1)}
      />
    ) : null;

  const PageLayout = isUsersTab ? FillPageLayout : ScrollPageLayout;

  return (
    <PageLayout>
      <AdminShell
        layout={isUsersTab ? 'fill' : 'scroll'}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        isSuperAdmin={isSuperAdmin}
        canManageWrapped={canManageWrapped}
        pendingReports={moderation.pendingReports}
      >
        <AdminFillTabPanel value="users">
          {activeTab === 'users' && (
            <AdminUsersTab
              search={users.search}
              onSearchChange={users.setSearch}
              userRoleGroup={users.userRoleGroup}
              onUserRoleGroupChange={users.setUserRoleGroup}
              isSuperAdmin={users.isSuperAdmin}
              viewportRef={users.viewportRef}
              usersData={users.usersData}
              isUsersLoading={users.isUsersLoading}
              isUsersError={users.isUsersError}
              usersError={users.usersError}
              refetchUsers={users.refetchUsers}
              selectedUserRoleMeta={users.selectedUserRoleMeta}
              currentUserId={users.currentUserId}
              canDeactivate={users.canDeactivate}
              onDeactivate={users.onDeactivate}
              onActivate={users.onActivate}
              pagination={usersPagination}
            />
          )}
        </AdminFillTabPanel>

        {isSuperAdmin ? (
          <AdminScrollTabPanel value="schedule">
            {activeTab === 'schedule' && (
              <AdminScheduleTab
                studentCsvInputKey={schedule.studentCsvInputKey}
                onStudentCsvFileChange={schedule.setStudentCsvFile}
                generatePasswords={schedule.generatePasswords}
                onGeneratePasswordsChange={schedule.setGeneratePasswords}
                canImport={schedule.canImport}
                isImporting={schedule.isImporting}
                onImport={schedule.onImport}
                isExporting={schedule.isExporting}
                onExport={schedule.onExport}
                lastStudentImport={schedule.lastStudentImport}
                onExportGeneratedPasswords={schedule.onExportGeneratedPasswords}
              />
            )}
          </AdminScrollTabPanel>
        ) : null}

        <AdminScrollTabPanel value="moderation">
          {activeTab === 'moderation' && (
            <ModerationTab
              keyword={moderation.keyword}
              onKeywordChange={moderation.setKeyword}
              keywords={moderation.keywords}
              addKeywordMutation={moderation.addKeywordMutation}
              removeKeywordMutation={moderation.removeKeywordMutation}
              moderationSearch={moderation.moderationSearch}
              onModerationSearchChange={moderation.setModerationSearch}
              deferredModerationSearch={moderation.deferredModerationSearch}
              filteredReports={moderation.filteredReports}
              pendingReports={moderation.pendingReports}
              reportMutation={moderation.reportMutation}
            />
          )}
        </AdminScrollTabPanel>

        <AdminScrollTabPanel value="permissions">
          {activeTab === 'permissions' && (
            <PermissionsTab
              search={permissions.permSearch}
              onSearchChange={permissions.setPermSearch}
              deferredSearch={permissions.deferredPermSearch}
              isLoading={permissions.isPermUsersLoading}
              users={permissions.permUsers}
              isSuperAdmin={isSuperAdmin}
              isPending={permissions.assignRolesMutation.isPending}
              onAssignRoles={(payload) => permissions.assignRolesMutation.mutate(payload)}
            />
          )}
        </AdminScrollTabPanel>

        <AdminScrollTabPanel value="student-admins">
          {activeTab === 'student-admins' && (
            <StudentAdminsTab
              search={permissions.studentAdminSearch}
              onSearchChange={permissions.setStudentAdminSearch}
              deferredSearch={permissions.deferredStudentAdminSearch}
              isLoading={permissions.isStudentAdminsLoading}
              users={permissions.studentAdmins}
              isPending={permissions.assignRolesMutation.isPending}
              onAssignRoles={(payload) => permissions.assignRolesMutation.mutate(payload)}
            />
          )}
        </AdminScrollTabPanel>

        {canManageWrapped ? (
          <AdminScrollTabPanel value="wrapped">
            {activeTab === 'wrapped' && (
              <WrappedSnapshotsTab
                wrappedSchoolYear={wrapped.wrappedSchoolYear}
                onWrappedSchoolYearChange={wrapped.setWrappedSchoolYear}
                wrappedYearOptions={wrapped.wrappedYearOptions}
                status={wrapped.status}
                isLoading={wrapped.isLoading}
                isError={wrapped.isError}
                error={wrapped.error}
                generateMutation={wrapped.generateMutation}
              />
            )}
          </AdminScrollTabPanel>
        ) : null}

        <AdminScrollTabPanel value="audit">
          <AuditTab activeTab={activeTab} />
        </AdminScrollTabPanel>
      </AdminShell>
    </PageLayout>
  );
}
