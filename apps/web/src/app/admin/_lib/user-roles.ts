import { getUserRoles } from './admin-utils';
import type { AdminUserRecord } from './types';

export type AssignableRole = {
  role: string;
  label: string;
  color: 'emerald' | 'blue' | 'purple' | 'amber' | 'red';
};

export const ASSIGNABLE_ROLES: AssignableRole[] = [
  { role: 'STUDENT_ADMIN', label: 'Student Admin', color: 'emerald' },
  { role: 'TEACHER', label: 'Teacher', color: 'blue' },
  { role: 'SPONSOR', label: 'Sponsor', color: 'purple' },
  { role: 'SUPPORT_STAFF', label: 'Support Staff', color: 'amber' },
  { role: 'ADMIN', label: 'Admin', color: 'red' },
];

export function getAssignableRoleOptions(isSuperAdmin: boolean) {
  return ASSIGNABLE_ROLES.filter((item) => item.role !== 'ADMIN' || isSuperAdmin);
}

export function canEditUserRoles(user: AdminUserRecord, isSuperAdmin: boolean) {
  const roles = getUserRoles(user);
  const isPrivileged = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
  return isPrivileged ? isSuperAdmin : true;
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
