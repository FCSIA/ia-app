'use client';

import { AdminUsersTab } from '../users/users-tab';
import { useAdminUsers } from '../../_hooks/use-admin-users';
import { useSearchParams } from 'next/navigation';

export function UsersTabPanel() {
  const searchParams = useSearchParams();
  const initialSearch = searchParams?.get('search') ?? '';

  return <UsersTabPanelContent key={initialSearch} initialSearch={initialSearch} />;
}

function UsersTabPanelContent({ initialSearch }: { initialSearch: string }) {
  const users = useAdminUsers('users', initialSearch);

  return (
    <AdminUsersTab
      search={users.search}
      onSearchChange={users.setSearch}
      userRoleGroup={users.userRoleGroup}
      onUserRoleGroupChange={users.setUserRoleGroup}
      isSuperAdmin={users.isSuperAdmin}
      users={users.users}
      totalCount={users.totalCount}
      status={users.status}
      canLoadPrevious={users.canLoadPrevious}
      pageIndex={users.pageIndex}
      loadNextPage={users.loadNextPage}
      loadPreviousPage={users.loadPreviousPage}
      isUsersLoading={users.isUsersLoading}
      isUsersError={users.isUsersError}
      usersError={users.usersError}
      refetchUsers={users.refetchUsers}
      selectedUserRoleMeta={users.selectedUserRoleMeta}
      currentUserId={users.currentUserId}
      canDeactivate={users.canDeactivate}
      canResetPassword={users.canResetPassword}
      canDeleteUsers={users.canDeleteUsers}
      onDeactivate={users.onDeactivate}
      onActivate={users.onActivate}
      onResetPassword={users.onResetPassword}
      onDeleteUsers={users.onDeleteUsers}
      isDeleteUsersPending={users.isDeleteUsersPending}
      isResetPasswordPending={users.isResetPasswordPending}
      isAssignRolesPending={users.isAssignRolesPending}
      onAssignRoles={users.onAssignRoles}
    />
  );
}
