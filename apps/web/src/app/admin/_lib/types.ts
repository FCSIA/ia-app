export type StudentImportResult = {
  created: number;
  skipped: number;
  errors: string[];
  generatedCredentials: Array<{
    firstName: string;
    lastName: string;
    uniqueId: string;
    email: string;
    temporaryPassword: string;
  }>;
};

export type AdministratorImportResult = StudentImportResult;

export type StudentBulkUpdateResult = {
  updated: number;
  skipped: number;
  errors: string[];
};

export type AuditActorScope = 'ALL' | 'USER' | 'SYSTEM';

export type AuditEventRecord = {
  id: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  createdAt: string;
  meta?: Record<string, unknown> | null;
  actor?: {
    id: string;
    firstName: string;
    lastName: string;
    uniqueId: string;
  } | null;
};

export type AuditEventDetail = AuditEventRecord & {
  entityPreview?: {
    kind: string;
    title: string;
    subtitle?: string | null;
    body?: string | null;
    href?: string | null;
    hrefLabel?: string | null;
    fields?: Array<{
      label: string;
      value: string;
    }>;
  } | null;
};

export type AdminUserRecord = {
  _id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  roles?: string[];
  gradeLevel?: number | null;
  major?: string | null;
  minor?: string | null;
  email?: string;
  avatarUrl?: string;
  isActive?: boolean;
  isDeveloper?: boolean;
};

export type AdminUserRoleGroup = 'students' | 'teachers' | 'other' | 'student-admin' | 'all';
