'use client';

import { PermissionsTab } from '../permissions-tab';
import { useAdminPermissions } from '../../_hooks/use-admin-permissions';
import { hasRole, useCurrentUser } from '@/lib/auth';

export function PermissionsTabPanel() {
  const user = useCurrentUser();
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const permissions = useAdminPermissions('permissions');

  return (
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
  );
}
