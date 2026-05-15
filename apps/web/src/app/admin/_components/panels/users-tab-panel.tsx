'use client';

import { AdminUsersTab, UsersPaginationControls } from '../users/users-tab';
import { useAdminUsers } from '../../_hooks/use-admin-users';

export function UsersTabPanel() {
  const users = useAdminUsers('users');

  const pagination =
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
      isAssignRolesPending={users.isAssignRolesPending}
      onAssignRoles={users.onAssignRoles}
      pagination={pagination}
    />
  );
}
