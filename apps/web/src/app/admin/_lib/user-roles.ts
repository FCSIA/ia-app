import { titleCaseEnum } from '~/apps/shared/labels';
import { type AppRole, canGrantRole, isPrivilegedAccount } from '~/apps/shared/roles';
import type { AdminUserRecord } from './types';

type AssignableRole = {
  role: AppRole;
  label: string;
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red';
};

const ASSIGNABLE_ROLES: AssignableRole[] = (
  [
    { role: 'STUDENT_ADMIN', color: 'emerald' },
    { role: 'TEACHER', color: 'blue' },
    { role: 'SPONSOR', color: 'purple' },
    { role: 'SUPPORT_STAFF', color: 'amber' },
    { role: 'ADMIN', color: 'red' },
  ] as const
).map((item) => ({ ...item, label: titleCaseEnum(item.role) }));

export function getAssignableRoleOptions(isSuperAdmin: boolean) {
  return ASSIGNABLE_ROLES.filter((item) => canGrantRole(isSuperAdmin, item.role));
}

export function canEditUserRoles(user: AdminUserRecord, isSuperAdmin: boolean) {
  return isPrivilegedAccount(user) ? isSuperAdmin : true;
}
