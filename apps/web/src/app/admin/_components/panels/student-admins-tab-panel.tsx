'use client';

import { StudentAdminsTab } from '../permissions-tab';
import { useAdminPermissions } from '../../_hooks/use-admin-permissions';

export function StudentAdminsTabPanel() {
  const permissions = useAdminPermissions('student-admins');

  return (
    <StudentAdminsTab
      search={permissions.studentAdminSearch}
      onSearchChange={permissions.setStudentAdminSearch}
      deferredSearch={permissions.deferredStudentAdminSearch}
      isLoading={permissions.isStudentAdminsLoading}
      users={permissions.studentAdmins}
      isPending={permissions.assignRolesMutation.isPending}
      onAssignRoles={(payload) => permissions.assignRolesMutation.mutate(payload)}
    />
  );
}
