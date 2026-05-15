import { format } from 'date-fns';
import type { AdminUserRecord, AdminUserRoleGroup } from './types';

export const AUDIT_FETCH_LIMIT = 250;
export const MIN_USERS_PAGE_SIZE = 6;
export const MAX_USERS_PAGE_SIZE = 20;
export const USER_TABLE_CHROME_HEIGHT = 112;
export const USER_TABLE_ROW_HEIGHT = 29;

export const USER_ROLE_GROUP_META: Record<AdminUserRoleGroup, { label: string; emptyMessage: string; showGrade: boolean }> = {
  students: {
    label: 'Students',
    emptyMessage: 'No students found.',
    showGrade: true,
  },
  teachers: {
    label: 'Teachers',
    emptyMessage: 'No teachers found.',
    showGrade: false,
  },
  other: {
    label: 'Other Roles',
    emptyMessage: 'No admin or staff accounts found.',
    showGrade: false,
  },
};

export function getUserRoles(user: AdminUserRecord) {
  if (user.roles?.length) return user.roles;
  return user.role ? [user.role] : [];
}

export function formatRoleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

export function schoolYearLabel(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return 'Never';
  return format(new Date(value), 'MMM d, yyyy h:mm a');
}

export function refreshWrappedResultTitle(generated: number, skipped: number) {
  if (generated === 0 && skipped > 0) return 'Wrapped snapshots already current';
  return `Generated ${generated} Wrapped snapshot${generated === 1 ? '' : 's'}`;
}

export function getDynamicUsersPageSize(availableHeight: number) {
  const computedPageSize = Math.floor((availableHeight - USER_TABLE_CHROME_HEIGHT) / USER_TABLE_ROW_HEIGHT);
  return Math.max(MIN_USERS_PAGE_SIZE, Math.min(MAX_USERS_PAGE_SIZE, computedPageSize));
}

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function downloadCsv(filename: string, rows: Array<Array<unknown>>, headers: string[]) {
  const content = [
    headers.map((header) => escapeCsvCell(header)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
