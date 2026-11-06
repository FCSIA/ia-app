import { titleCaseEnum } from '~/apps/shared/labels';
import { type AppRole, canGrantRole, isPrivilegedAccount } from '~/apps/shared/roles';
import type { AdminUserRecord } from './types';

export type AssignableRole = {
  role: AppRole;
  label: string;
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red';
};

export const ASSIGNABLE_ROLES: AssignableRole[] = (
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

export function activeRoleClass(color: AssignableRole['color']) {
  switch (color) {
    case 'blue':
      return 'border-blue-500/30 bg-blue-500/15 text-blue-600 hover:bg-blue-500/25';
    case 'purple':
      return 'border-purple-500/30 bg-purple-500/15 text-purple-600 hover:bg-purple-500/25';
    case 'amber':
      return 'border-amber-500/30 bg-amber-500/15 text-amber-600 hover:bg-amber-500/25';
    case 'emerald':
      return 'border-emerald-500/30 bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25';
    case 'red':
      return 'border-red-500/30 bg-red-500/15 text-red-600 hover:bg-red-500/25';
  }
}
