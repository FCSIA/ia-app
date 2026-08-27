import { format } from 'date-fns';
import type { AdminUserRecord, AdminUserRoleGroup } from './types';

export const AUDIT_FETCH_LIMIT = 250;

export const USER_ROLE_GROUP_META: Record<AdminUserRoleGroup, { label: string; emptyMessage: string }> = {
  students: {
    label: 'Students',
    emptyMessage: 'No students found.',
  },
  teachers: {
    label: 'Teachers',
    emptyMessage: 'No teachers found.',
  },
  other: {
    label: 'Other Roles',
    emptyMessage: 'No admin or staff accounts found.',
  },
  'student-admin': {
    label: 'Student Admins',
    emptyMessage: 'No student admins found.',
  },
  all: {
    label: 'All Users',
    emptyMessage: 'No users found.',
  },
};

export function getUserRoles(user: AdminUserRecord) {
  return user.roles ?? [];
}

export function formatRoleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

export function schoolYearLabel(startYear: number) {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

export function formatDateTime(value?: string | number | null) {
  if (!value) return 'Never';
  return format(new Date(value), 'MMM d, yyyy h:mm a');
}

export function refreshWrappedResultTitle(generated: number, skipped: number) {
  if (generated === 0 && skipped > 0) return 'Wrapped snapshots already current';
  return `Generated ${generated} Wrapped snapshot${generated === 1 ? '' : 's'}`;
}


export function escapeCsvCell(value: unknown) {
  const rawValue = String(value ?? '');
  const stringValue = /^[\t ]*[=+\-@]/.test(rawValue) ? `'${rawValue}` : rawValue;
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
