'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/layout/AppShell';
import { PageFrame } from '@/components/layout/page-frame';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { AdminShell } from './admin-shell';
import { AdminTabPanel } from './admin-tab-panel';
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

  return (
    <AppShell mainClassName={isUsersTab ? 'flex-1 overflow-hidden' : undefined}>
      <PageFrame
        className={cn(
          'pt-2',
          isUsersTab && 'flex h-full min-h-0 flex-1 flex-col overflow-hidden pb-0',
        )}
      >
        <AdminShell
          activeTab={activeTab}
          onTabChange={setActiveTab}
          isSuperAdmin={isSuperAdmin}
          canManageWrapped={canManageWrapped}
          pendingReports={moderation.pendingReports}
        >
          <AdminTabPanel value="users" variant="users">
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
          </AdminTabPanel>

          {isSuperAdmin ? (
            <AdminTabPanel value="schedule">
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
            </AdminTabPanel>
          ) : null}

          <AdminTabPanel value="moderation">
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
          </AdminTabPanel>

          <AdminTabPanel value="permissions">
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
          </AdminTabPanel>

          <AdminTabPanel value="student-admins">
            <StudentAdminsTab
              search={permissions.studentAdminSearch}
              onSearchChange={permissions.setStudentAdminSearch}
              deferredSearch={permissions.deferredStudentAdminSearch}
              isLoading={permissions.isStudentAdminsLoading}
              users={permissions.studentAdmins}
              isPending={permissions.assignRolesMutation.isPending}
              onAssignRoles={(payload) => permissions.assignRolesMutation.mutate(payload)}
            />
          </AdminTabPanel>

          {canManageWrapped ? (
            <AdminTabPanel value="wrapped">
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
            </AdminTabPanel>
          ) : null}

          <AdminTabPanel value="audit">
            <AuditTab activeTab={activeTab} />
          </AdminTabPanel>
        </AdminShell>
      </PageFrame>
    </AppShell>
  );
}
