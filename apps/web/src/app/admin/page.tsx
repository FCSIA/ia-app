'use client';

import { useState, useEffect, useDeferredValue, useMemo, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, moderationApi, auditApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import {
  Users,
  Shield,
  FileText,
  Upload,
  Plus,
  Trash2,
  CalendarDays,
  Download,
  X,
  Eye,
  KeyRound,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { DatePicker } from '@/components/ui/date-picker';
import { SearchInput } from '@/components/ui/search';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabPanel, TabsList, TabItem } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';

type StudentImportResult = {
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

type AuditActorScope = 'ALL' | 'USER' | 'SYSTEM';

type AuditEventRecord = {
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

type AuditEventDetail = AuditEventRecord & {
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

type AdminUserRecord = {
  id: string;
  uniqueId: string;
  firstName: string;
  lastName: string;
  role?: string | null;
  roles?: string[];
  gradeLevel?: number | null;
  isActive?: boolean;
};

type AdminUserRoleGroup = 'students' | 'teachers' | 'other';

const AUDIT_FETCH_LIMIT = 250;
const MIN_USERS_PAGE_SIZE = 6;
const MAX_USERS_PAGE_SIZE = 20;
const USER_TABLE_CHROME_HEIGHT = 112;
const USER_TABLE_ROW_HEIGHT = 29;
const USER_ROLE_GROUP_META: Record<AdminUserRoleGroup, { label: string; emptyMessage: string; showGrade: boolean }> = {
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

function getUserRoles(user: AdminUserRecord) {
  if (user.roles?.length) return user.roles;
  return user.role ? [user.role] : [];
}

function formatRoleLabel(role: string) {
  return role.replace(/_/g, ' ');
}

function getDynamicUsersPageSize(availableHeight: number) {
  const computedPageSize = Math.floor((availableHeight - USER_TABLE_CHROME_HEIGHT) / USER_TABLE_ROW_HEIGHT);
  return Math.max(MIN_USERS_PAGE_SIZE, Math.min(MAX_USERS_PAGE_SIZE, computedPageSize));
}

function UsersPaginationControls({
  page,
  total,
  pageSize,
  onPrev,
  onNext,
}: {
  page: number;
  total: number;
  pageSize: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  const totalPages = Math.ceil(total / pageSize);

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 border-t px-4 py-2.5">
      <Button variant="tertiary" size="sm" className="h-7 px-2.5 text-[11px]" disabled={page === 1} onClick={onPrev}>
        Prev
      </Button>
      <span className="text-[11px] text-muted-foreground">
        Page {page} of {totalPages}
      </span>
      <Button
        variant="tertiary"
        size="sm"
        className="h-7 px-2.5 text-[11px]"
        disabled={page >= totalPages}
        onClick={onNext}
      >
        Next
      </Button>
    </div>
  );
}

function UserTableSection({
  title,
  emptyMessage,
  users,
  totalCount,
  showGrade = false,
  currentUserId,
  canDeactivate,
  onDeactivate,
  onActivate,
  pagination,
}: {
  title: string;
  emptyMessage: string;
  users: AdminUserRecord[];
  totalCount?: number;
  showGrade?: boolean;
  currentUserId?: string;
  canDeactivate: (user: AdminUserRecord) => boolean;
  onDeactivate: (userId: string) => void;
  onActivate: (userId: string) => void;
  pagination?: ReactNode;
}) {
  const headers = showGrade
    ? ['ID', 'Name', 'Grade', 'Roles', 'Status', 'Actions']
    : ['ID', 'Name', 'Roles', 'Status', 'Actions'];

  return (
    <Card className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <CardHeader className="border-b px-4 py-2.5">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-sm">{title}</CardTitle>
          <Badge variant="solid" className="px-2 py-0 text-[10px]">
            {totalCount ?? users.length}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0">
        <Table className="text-[11px]">
          <TableHeader className="bg-muted/50">
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header} className="h-8 px-3 py-1 text-[10px] uppercase tracking-wide">
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length} className="px-3 py-8 text-center text-[11px] text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id} className="hover:bg-muted/30">
                  <TableCell className="px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
                    {user.uniqueId}
                  </TableCell>
                  <TableCell className="px-3 py-1.5 text-[11px] font-medium leading-tight">
                    {user.firstName} {user.lastName}
                  </TableCell>
                  {showGrade ? (
                    <TableCell className="px-3 py-1.5 text-[11px] text-muted-foreground">
                      {user.gradeLevel || '—'}
                    </TableCell>
                  ) : null}
                  <TableCell className="px-3 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {getUserRoles(user).map((role) => (
                        <Badge key={role} variant="dot" className="px-1.5 py-0 text-[9px]">
                          {formatRoleLabel(role)}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    <Badge
                      variant={user.isActive ? 'solid' : 'solid'}
                      className={
                        user.isActive
                          ? 'border-none bg-emerald-500/15 px-1.5 py-0 text-[9px] text-emerald-500'
                          : 'border-none bg-red-500/15 px-1.5 py-0 text-[9px] text-red-500'
                      }
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-1.5">
                    {user.isActive ? (
                      canDeactivate(user) && user.id !== currentUserId ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onDeactivate(user.id)}
                          className="h-6 px-2 text-[10px] text-red-500 hover:bg-red-500/10 hover:text-red-400"
                        >
                          Deactivate
                        </Button>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onActivate(user.id)}
                        className="h-6 px-2 text-[10px] text-emerald-500 hover:bg-emerald-500/10 hover:text-emerald-400"
                      >
                        Activate
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
      {pagination}
    </Card>
  );
}

function escapeCsvCell(value: unknown) {
  const stringValue = String(value ?? '');
  if (/[",\n]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

function downloadCsv(filename: string, rows: Array<Array<unknown>>, headers: string[]) {
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

export default function AdminPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const { toast } = useToast();
  const usersViewportRef = useRef<HTMLDivElement | null>(null);
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>('students');
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [studentCsvFile, setStudentCsvFile] = useState<File | null>(null);
  const [studentCsvInputKey, setStudentCsvInputKey] = useState(0);
  const [generatePasswords, setGeneratePasswords] = useState(true);
  const [lastStudentImport, setLastStudentImport] = useState<StudentImportResult | null>(null);

  const [moderationSearch, setModerationSearch] = useState('');
  const deferredModerationSearch = useDeferredValue(moderationSearch);
  const [auditSearch, setAuditSearch] = useState('');
  const deferredAuditSearch = useDeferredValue(auditSearch);
  const [auditActor, setAuditActor] = useState('');
  const deferredAuditActor = useDeferredValue(auditActor);
  const [auditEntityId, setAuditEntityId] = useState('');
  const deferredAuditEntityId = useDeferredValue(auditEntityId);
  const [auditActionFilter, setAuditActionFilter] = useState('ALL');
  const [auditEntityTypeFilter, setAuditEntityTypeFilter] = useState('ALL');
  const [auditActorScope, setAuditActorScope] = useState<AuditActorScope>('ALL');
  const [auditStartDate, setAuditStartDate] = useState('');
  const [auditEndDate, setAuditEndDate] = useState('');
  const [selectedAuditEventId, setSelectedAuditEventId] = useState<string | null>(null);
  const [permSearch, setPermSearch] = useState('');
  const deferredPermSearch = useDeferredValue(permSearch);
  const [studentAdminSearch, setStudentAdminSearch] = useState('');
  const deferredStudentAdminSearch = useDeferredValue(studentAdminSearch);
  const [auditSubView, setAuditSubView] = useState<'general' | 'flex'>('general');
  const qc = useQueryClient();

  // Permission: can current user deactivate this target user?
  const canDeactivate = (targetUser: AdminUserRecord) => {
    if (!user) return false;
    const targetRoles = getUserRoles(targetUser);
    const isTargetPrivileged = targetRoles.includes('ADMIN') || targetRoles.includes('SUPER_ADMIN');
    // Only Super Admin can deactivate privileged users
    if (isTargetPrivileged) return hasRole(user, 'SUPER_ADMIN');
    // Admins can deactivate everyone else
    return hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  };

  useEffect(() => {
    if (user && !hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'SUPPORT_STAFF')) {
      router.replace('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (activeTab !== 'users') return;

    const updateUsersPageSize = () => {
      const availableHeight = usersViewportRef.current?.clientHeight ?? 0;
      if (availableHeight <= 0) return;

      const nextPageSize = getDynamicUsersPageSize(availableHeight);
      setUsersPageSize((currentPageSize) => (
        currentPageSize === nextPageSize ? currentPageSize : nextPageSize
      ));
    };

    const frameId = window.requestAnimationFrame(updateUsersPageSize);
    const resizeObserver = typeof ResizeObserver !== 'undefined' && usersViewportRef.current
      ? new ResizeObserver(updateUsersPageSize)
      : null;

    if (resizeObserver && usersViewportRef.current) {
      resizeObserver.observe(usersViewportRef.current);
    }

    window.addEventListener('resize', updateUsersPageSize);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.removeEventListener('resize', updateUsersPageSize);
      resizeObserver?.disconnect();
    };
  }, [activeTab]);

  const {
    data: usersData,
    isLoading: isUsersLoading,
    isError: isUsersError,
    error: usersError,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ['admin-users', page, search, userRoleGroup, usersPageSize],
    queryFn: () => usersApi.getAll(page, usersPageSize, search || undefined, userRoleGroup).then((r) => r.data),
    enabled: activeTab === 'users',
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords'],
    queryFn: () => moderationApi.getKeywords().then((r) => r.data),
    enabled: activeTab === 'moderation',
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => moderationApi.getReports().then((r) => r.data),
    enabled: activeTab === 'moderation',
  });

  useEffect(() => {
    const totalPages = usersData?.total ? Math.max(1, Math.ceil(usersData.total / usersPageSize)) : 1;
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, usersData?.total, usersPageSize]);

  const auditQueryParams = useMemo(
    () => ({
      limit: AUDIT_FETCH_LIMIT,
      query: deferredAuditSearch.trim() || undefined,
      actor: deferredAuditActor.trim() || undefined,
      entityId: deferredAuditEntityId.trim() || undefined,
      action: auditActionFilter !== 'ALL' ? auditActionFilter : undefined,
      entityType: auditEntityTypeFilter !== 'ALL' ? auditEntityTypeFilter : undefined,
      actorScope: auditActorScope !== 'ALL' ? auditActorScope : undefined,
      startDate: auditStartDate || undefined,
      endDate: auditEndDate || undefined,
    }),
    [
      auditActionFilter,
      auditActorScope,
      auditEndDate,
      auditEntityTypeFilter,
      auditStartDate,
      deferredAuditSearch,
      deferredAuditActor,
      deferredAuditEntityId,
    ],
  );

  const { data: auditEvents = [], isLoading: isAuditLoading } = useQuery<AuditEventRecord[]>({
    queryKey: ['audit', auditQueryParams],
    queryFn: () => auditApi.getAll(auditQueryParams).then((r) => r.data),
    enabled: activeTab === 'audit',
  });

  const FLEX_ENTITY_TYPES = ['FlexFriday', 'FlexSession', 'FlexWorkshop', 'FlexRegistration', 'FlexAssignment', 'Event'];

  const displayedAuditEvents = useMemo(() => {
    if (auditSubView === 'flex') {
      return auditEvents.filter((e) => FLEX_ENTITY_TYPES.includes(e.entityType));
    }
    return auditEvents.filter((e) => !FLEX_ENTITY_TYPES.includes(e.entityType));
  }, [auditEvents, auditSubView]);


  const { data: auditFilterSource = [] } = useQuery<AuditEventRecord[]>({
    queryKey: ['audit', 'filter-source'],
    queryFn: () => auditApi.getAll({ limit: 500 }).then((r) => r.data),
    enabled: activeTab === 'audit',
  });

  const { data: auditEventDetail, isLoading: isAuditDetailLoading } = useQuery<AuditEventDetail>({
    queryKey: ['audit', 'entry', selectedAuditEventId],
    queryFn: () => auditApi.getOne(selectedAuditEventId!).then((r) => r.data),
    enabled: !!selectedAuditEventId,
  });

  const filteredReports = useMemo(() => {
    const query = deferredModerationSearch.trim().toLowerCase();
    if (!query) return reports;
    return (reports as any[]).filter((r) => {
      const searchable = [
        r.reason,
        r.contentType,
        r.submitter?.firstName,
        r.submitter?.lastName,
        r.status,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [reports, deferredModerationSearch]);

  const auditActionOptions = useMemo(
    () => Array.from(new Set(auditFilterSource.map((event) => event.action))).sort(),
    [auditFilterSource],
  );

  const auditEntityTypeOptions = useMemo(
    () => Array.from(new Set(auditFilterSource.map((event) => event.entityType))).sort(),
    [auditFilterSource],
  );

  const hasActiveAuditFilters =
    !!auditSearch.trim() ||
    !!auditActor.trim() ||
    !!auditEntityId.trim() ||
    auditActionFilter !== 'ALL' ||
    auditEntityTypeFilter !== 'ALL' ||
    auditActorScope !== 'ALL' ||
    !!auditStartDate ||
    !!auditEndDate;

  const clearAuditFilters = () => {
    setAuditSearch('');
    setAuditActor('');
    setAuditEntityId('');
    setAuditActionFilter('ALL');
    setAuditEntityTypeFilter('ALL');
    setAuditActorScope('ALL');
    setAuditStartDate('');
    setAuditEndDate('');
  };

  const setAuditStartDateWithBounds = (value: string) => {
    setAuditStartDate(value);
    if (value && auditEndDate && value > auditEndDate) {
      setAuditEndDate(value);
    }
  };

  const setAuditEndDateWithBounds = (value: string) => {
    setAuditEndDate(value);
    if (value && auditStartDate && value < auditStartDate) {
      setAuditStartDate(value);
    }
  };

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast({ title: 'Deactivated' }); },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast({ title: 'Activated' }); },
  });

  const addKeywordMutation = useMutation({
    mutationFn: (kw: string) => moderationApi.addKeyword(kw),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keywords'] }); setKeyword(''); toast({ title: 'Keyword added' }); },
  });

  const removeKeywordMutation = useMutation({
    mutationFn: (id: string) => moderationApi.removeKeyword(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keywords'] }); toast({ title: 'Removed' }); },
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status, reviewNote }: any) => moderationApi.updateReport(id, { status, reviewNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast({ title: 'Report updated' }); },
  });

  const importStudentsMutation = useMutation({
    mutationFn: async () => {
      if (!studentCsvFile) throw new Error('Select a CSV file first');
      const response = await usersApi.importCsv(studentCsvFile, { generatePasswords });
      return response.data as StudentImportResult;
    },
    onSuccess: (data) => {
      setLastStudentImport(data);
      setStudentCsvFile(null);
      setStudentCsvInputKey((current) => current + 1);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast({
        title: `Imported ${data.created} students`,
        description: `${data.skipped} skipped${data.generatedCredentials.length ? ' · temp passwords ready to export' : ''}`,
      });
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || err.message || 'Import failed', variant: 'destructive' });
    },
  });

  const { data: permUsersData, isLoading: isPermUsersLoading } = useQuery({
    queryKey: ['perm-users', deferredPermSearch],
    queryFn: () =>
      usersApi.getAll(1, 30, deferredPermSearch || undefined, undefined).then((r) => r.data),
    enabled: activeTab === 'permissions',
  });

  const { data: studentAdminsData, isLoading: isStudentAdminsLoading } = useQuery({
    queryKey: ['student-admins', deferredStudentAdminSearch],
    queryFn: () =>
      usersApi.getAll(1, 50, deferredStudentAdminSearch || undefined, 'student-admin' as any).then((r) => r.data),
    enabled: activeTab === 'student-admins',
  });

  const assignRolesMutation = useMutation({
    mutationFn: ({ id, roles }: { id: string; roles: string[] }) =>
      usersApi.assignRoles(id, roles),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['perm-users'] });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['student-admins'] });
      toast({ title: 'Permissions updated' });
    },
    onError: (e: any) =>
      toast({ title: e.response?.data?.message || 'Failed to update permissions', variant: 'destructive' }),
  });

  const exportStudentsMutation = useMutation({
    mutationFn: () => usersApi.exportStudentsCsv(),
    onSuccess: (response) => {
      const blob = response.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'students.csv';
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: 'Student CSV exported' });
    },
    onError: (err: any) => {
      toast({ title: err.response?.data?.message || 'Could not export students', variant: 'destructive' });
    },
  });

  const exportGeneratedPasswords = () => {
    if (!lastStudentImport?.generatedCredentials.length) return;

    downloadCsv(
      'student-temp-passwords.csv',
      lastStudentImport.generatedCredentials.map((student) => [
        student.firstName,
        student.lastName,
        student.uniqueId,
        student.email,
        student.temporaryPassword,
      ]),
      ['first_name', 'last_name', 'student_id', 'email', 'temporary_password'],
    );

    toast({ title: 'Temporary passwords exported' });
  };

  const pendingReports = (reports as any[]).filter((r: any) => r.status === 'PENDING').length;
  const selectedUserRoleMeta = USER_ROLE_GROUP_META[userRoleGroup];
  const usersPagination = usersData?.total ? (
    <UsersPaginationControls
      page={page}
      total={usersData.total}
      pageSize={usersPageSize}
      onPrev={() => setPage((p) => p - 1)}
      onNext={() => setPage((p) => p + 1)}
    />
  ) : null;

  const auditFilterChips = [
    auditSearch.trim() ? `Search: ${auditSearch.trim()}` : null,
    auditActor.trim() ? `Actor: ${auditActor.trim()}` : null,
    auditEntityId.trim() ? `Entity ID: ${auditEntityId.trim()}` : null,
    auditActionFilter !== 'ALL' ? `Action: ${auditActionFilter}` : null,
    auditEntityTypeFilter !== 'ALL' ? `Entity: ${auditEntityTypeFilter}` : null,
    auditActorScope !== 'ALL'
      ? `Source: ${auditActorScope === 'SYSTEM' ? 'System' : 'User'}`
      : null,
    auditStartDate
      ? `From: ${format(new Date(`${auditStartDate}T00:00:00`), 'MMM d, yyyy')}`
      : null,
    auditEndDate ? `To: ${format(new Date(`${auditEndDate}T00:00:00`), 'MMM d, yyyy')}` : null,
  ].filter((value): value is string => !!value);

  return (
    <AppShell
      mainClassName={
        activeTab === 'users'
          ? 'flex-1 overflow-hidden px-4 pb-3 pt-3 md:px-5 md:pb-4 md:pt-4 lg:px-6'
          : undefined
      }
    >
      <div className={cn('w-full', activeTab === 'users' && 'flex h-full flex-col overflow-hidden')}>
        {/* Header */}
        <div className={cn('mb-6', activeTab === 'users' && 'mb-3 shrink-0')}>
          <h1 className={cn('text-2xl font-bold text-foreground', activeTab === 'users' && 'text-xl')}>Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage users, moderation, and activity logs</p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={cn('w-full', activeTab === 'users' && 'flex min-h-0 flex-1 flex-col')}
        >
          <TabsList className={cn('mb-6 bg-secondary/50 p-1', activeTab === 'users' && 'mb-3 h-8 shrink-0')}>
            <TabItem value="users" icon={Users} className={cn(activeTab === 'users' && 'px-2.5 py-1 text-xs')} label="Users" />
            {isSuperAdmin && (
              <TabItem value="schedule" icon={CalendarDays} className={cn(activeTab === 'users' && 'px-2.5 py-1 text-xs')} label="Schedule" />
            )}
            <TabItem
              value="moderation"
              icon={Shield}
              className={cn(activeTab === 'users' && 'px-2.5 py-1 text-xs')}
              label={pendingReports > 0 ? `Moderation (${pendingReports})` : 'Moderation'}
            />
            <TabItem value="permissions" icon={KeyRound} className={cn(activeTab === 'users' && 'px-2.5 py-1 text-xs')} label="Permissions" />
            <TabItem value="student-admins" icon={Users} className={cn(activeTab === 'users' && 'px-2.5 py-1 text-xs')} label="Student Admins" />
            <TabItem value="audit" icon={FileText} className={cn(activeTab === 'users' && 'px-2.5 py-1 text-xs')} label="Audit Log" />
          </TabsList>

          {/* ── Users Tab ── */}
          <TabPanel value="users" className="mt-0 flex min-h-0 flex-1 flex-col">
            <div className="flex min-h-0 flex-1 flex-col gap-3">
              <div className="flex shrink-0 items-center gap-2.5 flex-wrap">
                <SearchInput
                  className="h-8 max-w-xs text-xs"
                  placeholder="Search users…"
                  value={search}
                  onValueChange={(value) => {
                    setSearch(value);
                    setPage(1);
                  }}
                  size="sm"
                  inputClassName="text-xs"
                />
                <Select
                  value={userRoleGroup}
                  onValueChange={(value) => {
                    setUserRoleGroup(value as AdminUserRoleGroup);
                    setPage(1);
                  }}
                >
                  <SelectTrigger className="h-8 w-[200px] text-xs" placeholder="Select role view" />
                  <SelectContent>
                    <SelectItem index={0} value="students">Students</SelectItem>
                    <SelectItem index={0} value="teachers">Teachers</SelectItem>
                    <SelectItem index={0} value="other">Other Roles</SelectItem>
                  </SelectContent>
                </Select>
                {isSuperAdmin && (
                  <p className="text-[11px] text-muted-foreground">
                    Student roster import/export lives in the Schedule tab.
                  </p>
                )}
              </div>

              <div ref={usersViewportRef} className="flex min-h-0 flex-1 flex-col">
                {isUsersLoading && !usersData ? (
                  <Card className="flex min-h-0 flex-1">
                    <CardContent className="flex flex-1 items-center justify-center py-8 text-center text-[11px] text-muted-foreground">
                      Loading users...
                    </CardContent>
                  </Card>
                ) : isUsersError ? (
                  <Card className="flex min-h-0 flex-1">
                    <CardContent className="flex flex-1 flex-col items-center justify-center gap-3 py-8 text-center">
                      <div>
                        <p className="font-medium text-foreground">Could not load users.</p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          {(usersError as any)?.response?.data?.message || (usersError as Error)?.message || 'Request failed.'}
                        </p>
                      </div>
                      <Button type="button" variant="tertiary" size="sm" className="h-7 text-[11px]" onClick={() => refetchUsers()}>
                        Try again
                      </Button>
                    </CardContent>
                  </Card>
                ) : (usersData?.users || []).length === 0 ? (
                  <Card className="flex min-h-0 flex-1">
                    <CardContent className="flex flex-1 items-center justify-center py-8 text-center text-[11px] text-muted-foreground">
                      {selectedUserRoleMeta.emptyMessage}
                    </CardContent>
                  </Card>
                ) : (
                  <UserTableSection
                    title={selectedUserRoleMeta.label}
                    emptyMessage={selectedUserRoleMeta.emptyMessage}
                    users={(usersData?.users || []) as AdminUserRecord[]}
                    totalCount={usersData?.total}
                    showGrade={selectedUserRoleMeta.showGrade}
                    currentUserId={user?.id}
                    canDeactivate={canDeactivate}
                    onDeactivate={(userId) => deactivateMutation.mutate(userId)}
                    onActivate={(userId) => activateMutation.mutate(userId)}
                    pagination={usersPagination}
                  />
                )}
              </div>
            </div>
          </TabPanel>

          {/* ── Schedule Tab ── */}
          {isSuperAdmin && (
            <TabPanel value="schedule">
              <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
                <Card>
                  <CardHeader className="border-b pb-4">
                    <CardTitle className="text-base">Saturn-Style Student Roster Import</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Import students from a roster CSV. Email is derived automatically as <span className="font-mono text-foreground">student_id@fcstu.org</span>.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {['First Name', 'Last Name', 'Student ID', 'Grade Level', 'Major Pathway', 'Minor Pathway (optional)'].map((field) => (
                          <Badge key={field} variant="dot" className="text-[11px]">
                            {field}
                          </Badge>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Accepted pathway labels: <span className="text-foreground">IT</span>, <span className="text-foreground">Health Science</span>, <span className="text-foreground">Engineering</span>.
                      </p>
                    </div>

                    <div className="space-y-3">
                      <Input
                        key={studentCsvInputKey}
                        type="file"
                        accept=".csv"
                        onChange={(event) => setStudentCsvFile(event.target.files?.[0] || null)}
                      />
                      <div className="flex flex-wrap items-center gap-3">
                        <Button
                          type="button"
                          variant={generatePasswords ? 'primary' : 'tertiary'}
                          onClick={() => setGeneratePasswords((current) => !current)}
                        >
                          {generatePasswords ? 'Temp Passwords On' : 'Temp Passwords Off'}
                        </Button>
                        <Button
                          type="button"
                          onClick={() => importStudentsMutation.mutate()}
                          disabled={!studentCsvFile || importStudentsMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Upload size={16} />
                          {importStudentsMutation.isPending ? 'Importing…' : 'Import Students'}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => exportStudentsMutation.mutate()}
                          disabled={exportStudentsMutation.isPending}
                          className="flex items-center gap-2"
                        >
                          <Download size={16} />
                          {exportStudentsMutation.isPending ? 'Exporting…' : 'Export CSV'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {generatePasswords
                          ? 'New students will receive a random temporary password that you can export after import.'
                          : 'If disabled, new students default to their student ID as the initial password.'}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-6">
                  <Card>
                    <CardHeader className="border-b pb-4">
                      <CardTitle className="text-base">Import Notes</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-3 text-sm text-muted-foreground">
                      <p>Grade level must be a number from 9 to 12.</p>
                      <p>Minor pathway must be different from the major pathway.</p>
                      <p>Existing student IDs are skipped to avoid overwriting live accounts.</p>
                    </CardContent>
                  </Card>

                  {lastStudentImport && (
                    <Card>
                      <CardHeader className="border-b pb-4">
                        <CardTitle className="text-base">Latest Import</CardTitle>
                      </CardHeader>
                      <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-3 gap-3">
                          <div className="rounded-xl border p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Created</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{lastStudentImport.created}</p>
                          </div>
                          <div className="rounded-xl border p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Skipped</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{lastStudentImport.skipped}</p>
                          </div>
                          <div className="rounded-xl border p-3">
                            <p className="text-xs uppercase tracking-wide text-muted-foreground">Temp Passwords</p>
                            <p className="mt-2 text-2xl font-semibold text-foreground">{lastStudentImport.generatedCredentials.length}</p>
                          </div>
                        </div>

                        {lastStudentImport.generatedCredentials.length > 0 && (
                          <Button type="button" onClick={exportGeneratedPasswords} className="flex items-center gap-2">
                            <Download size={16} /> Export Temp Passwords CSV
                          </Button>
                        )}

                        {lastStudentImport.errors.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium text-foreground">Skipped rows</p>
                            <div className="max-h-48 overflow-y-auto rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                              {lastStudentImport.errors.map((error, index) => (
                                <p key={`${error}-${index}`} className="leading-5">{error}</p>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </TabPanel>
          )}

          {/* ── Moderation Tab ── */}
          <TabPanel value="moderation">
            <div className="grid gap-6">
              {/* Local safety rules */}
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle className="text-base">Local Safety Rules</CardTitle>
                    <Badge variant="dot" color="blue" className="text-[11px]">
                      glin-profanity enabled
                    </Badge>
                  </div>
                  <CardDescription>
                    External profanity filtering handles the main dictionary. Add IA-specific words here only when a local policy term, threat, or harassment phrase needs extra tracking.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="mb-5 grid gap-3 rounded-2xl border bg-muted/20 p-3 text-sm text-muted-foreground md:grid-cols-3">
                    <div>
                      <p className="font-medium text-foreground">Detected automatically</p>
                      <p className="mt-1 text-xs leading-5">Profanity library, Unicode normalization, and package defaults.</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Tracked locally</p>
                      <p className="mt-1 text-xs leading-5">Only active school-added terms below create keyword match records.</p>
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Admin visibility</p>
                      <p className="mt-1 text-xs leading-5">Filtered content creates a report in the moderation queue.</p>
                    </div>
                  </div>

                  <div className="mb-5 flex flex-col gap-2 sm:flex-row">
                    <Input
                      className="max-w-sm"
                      placeholder="Add local term..."
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && keyword.trim()) addKeywordMutation.mutate(keyword.trim());
                      }}
                    />
                    <Button
                      onClick={() => keyword.trim() && addKeywordMutation.mutate(keyword.trim())}
                      leadingIcon={Plus}
                      disabled={!keyword.trim() || addKeywordMutation.isPending}
                    >
                      Add rule
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(keywords as any[]).map((kw: any) => (
                      <Badge
                        key={kw.id}
                        variant="solid"
                        color="red"
                        className="gap-1.5 px-3 py-1.5 transition-all duration-150 hover:-translate-y-px hover:bg-red-500/20"
                      >
                        {kw.keyword}
                        <button
                          onClick={() => removeKeywordMutation.mutate(kw.id)}
                          className="ml-1 rounded-full p-0.5 transition-colors hover:bg-red-500/15 hover:text-red-400"
                          aria-label={`Remove ${kw.keyword}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      </Badge>
                    ))}
                    {(keywords as any[]).length === 0 && (
                      <p className="text-sm text-muted-foreground">No local safety rules configured.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reports */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Moderation Queue</CardTitle>
                    {pendingReports > 0 && (
                      <Badge variant="solid" color="red">{pendingReports} pending</Badge>
                    )}
                  </div>
                  <div className="w-full max-w-xs">
                    <SearchInput
                      value={moderationSearch}
                      onValueChange={setModerationSearch}
                      className="h-8 rounded-lg text-xs"
                      inputClassName="text-xs"
                      placeholder="Search reports..."
                      size="sm"
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {filteredReports.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground text-sm">
                        {deferredModerationSearch ? 'No reports match your search' : 'No reports submitted'}
                      </p>
                      {deferredModerationSearch && (
                        <Button variant="ghost" size="sm" onClick={() => setModerationSearch('')} className="mt-1 font-semibold text-accent-500">
                          Clear search
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredReports.map((r: any) => (
                        <div
                          key={r.id}
                          className="rounded-xl p-4 border bg-card transition-colors hover:bg-muted/30"
                        >
                          <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                            <div>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  r.status === 'PENDING' ? 'solid' :
                                    r.status === 'RESOLVED' ? 'dot' : 'solid'
                                } className={
                                  r.status === 'PENDING' ? 'bg-amber-500/15 text-amber-500 border-none' :
                                    r.status === 'RESOLVED' ? 'text-emerald-500 border-emerald-500/30' : ''
                                }>
                                  {r.status}
                                </Badge>
                                <Badge variant="dot">{r.contentType}</Badge>
                              </div>
                              <p className="text-sm font-medium">{r.reason}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                By {r.submitter?.firstName} {r.submitter?.lastName}
                              </p>
                            </div>
                            {r.status === 'PENDING' && (
                              <div className="flex gap-2 flex-shrink-0">
                                <Button
                                  size="sm"
                                  onClick={() => reportMutation.mutate({ id: r.id, status: 'RESOLVED', reviewNote: 'Reviewed' })}
                                >
                                  Resolve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  onClick={() => reportMutation.mutate({ id: r.id, status: 'DISMISSED', reviewNote: 'Dismissed' })}
                                >
                                  Dismiss
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabPanel>

          {/* ── Permissions Tab ── */}
          <TabPanel value="permissions">
            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base">Content Creator Permissions</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Grant or revoke roles that allow users to add sessions, workshops, announcements, and events.
                    Search for any user and toggle their permissions below.
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <SearchInput
                      className="max-w-xs"
                      placeholder="Search by name or ID…"
                      value={permSearch}
                      onValueChange={setPermSearch}
                    />
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <Badge variant="dot" className="gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Teacher — sessions &amp; workshops</Badge>
                      <Badge variant="dot" className="gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block" /> Sponsor — club management</Badge>
                      <Badge variant="dot" className="gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Support Staff — announcements &amp; events</Badge>
                    </div>
                  </div>

                  {isPermUsersLoading ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
                  ) : (permUsersData?.users ?? []).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      {deferredPermSearch ? 'No users match your search' : 'No users found'}
                    </p>
                  ) : (
                    <div className="divide-y divide-border rounded-xl border overflow-hidden">
                      {((permUsersData?.users ?? []) as AdminUserRecord[]).map((u) => {
                        const roles = getUserRoles(u);
                        const isPrivileged = roles.includes('ADMIN') || roles.includes('SUPER_ADMIN');
                        const canEditThis = isPrivileged ? isSuperAdmin : true;

                        const CONTENT_ROLES: Array<{ role: string; label: string; color: string }> = [
                          { role: 'STUDENT_ADMIN', label: 'Student Admin', color: 'emerald' },
                          { role: 'TEACHER', label: 'Teacher', color: 'blue' },
                          { role: 'SPONSOR', label: 'Sponsor', color: 'purple' },
                          { role: 'SUPPORT_STAFF', label: 'Support Staff', color: 'amber' },
                          ...(isSuperAdmin ? [{ role: 'ADMIN', label: 'Admin', color: 'red' }] : []),
                        ];

                        const toggleRole = (role: string) => {
                          if (!canEditThis) return;
                          const current = roles;
                          const next = current.includes(role)
                            ? current.filter((r) => r !== role)
                            : [...current, role];
                          assignRolesMutation.mutate({ id: u.id, roles: next });
                        };

                        return (
                          <div key={u.id} className="flex flex-col gap-3 px-4 py-3 bg-background sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{u.uniqueId}</p>
                              {u.gradeLevel && (
                                <p className="text-xs text-muted-foreground mt-0.5">Grade {u.gradeLevel}</p>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2 flex-shrink-0">
                              {CONTENT_ROLES.map(({ role, label, color }) => {
                                const active = roles.includes(role);
                                return (
                                  <button
                                    key={role}
                                    disabled={!canEditThis || assignRolesMutation.isPending}
                                    onClick={() => toggleRole(role)}
                                    className={cn(
                                      'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-all',
                                      active
                                        ? color === 'blue' ? 'bg-blue-500/15 text-blue-600 border-blue-500/30 hover:bg-blue-500/25'
                                          : color === 'purple' ? 'bg-purple-500/15 text-purple-600 border-purple-500/30 hover:bg-purple-500/25'
                                          : color === 'amber' ? 'bg-amber-500/15 text-amber-600 border-amber-500/30 hover:bg-amber-500/25'
                                          : color === 'emerald' ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/25'
                                          : 'bg-red-500/15 text-red-600 border-red-500/30 hover:bg-red-500/25'
                                        : 'bg-muted/40 text-muted-foreground border-border hover:bg-muted/70',
                                      !canEditThis && 'cursor-not-allowed opacity-50',
                                    )}
                                  >
                                    {active && <Check size={10} />}
                                    {label}
                                  </button>
                                );
                              })}
                              {!canEditThis && (
                                <span className="text-xs text-muted-foreground self-center">Super Admin only</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabPanel>

          {/* ── Student Admins Tab ── */}
          <TabPanel value="student-admins">
            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b pb-4">
                  <CardTitle className="text-base">Student Admins</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Students with admin privileges to add and remove events. Admins and Super Admins can revoke this role.
                  </p>
                </CardHeader>
                <CardContent className="pt-5 space-y-4">
                  <SearchInput
                    className="max-w-xs"
                    placeholder="Search by name or ID…"
                    value={studentAdminSearch}
                    onValueChange={setStudentAdminSearch}
                  />
                  {isStudentAdminsLoading ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
                  ) : ((studentAdminsData?.users ?? []) as AdminUserRecord[]).length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      {deferredStudentAdminSearch ? 'No student admins match your search' : 'No student admins assigned yet'}
                    </p>
                  ) : (
                    <div className="divide-y divide-border rounded-xl border overflow-hidden">
                      {((studentAdminsData?.users ?? []) as AdminUserRecord[]).map((u) => {
                        const roles = getUserRoles(u);
                        const removeStudentAdmin = () => {
                          if (!confirm(`Remove Student Admin role from ${u.firstName} ${u.lastName}?`)) return;
                          const next = roles.filter((r) => r !== 'STUDENT_ADMIN');
                          assignRolesMutation.mutate({ id: u.id, roles: next });
                        };
                        return (
                          <div key={u.id} className="flex flex-col gap-3 px-4 py-3 bg-background sm:flex-row sm:items-center sm:justify-between hover:bg-muted/20 transition-colors">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-foreground leading-tight">
                                {u.firstName} {u.lastName}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">{u.uniqueId}</p>
                              {u.gradeLevel && (
                                <p className="text-xs text-muted-foreground mt-0.5">Grade {u.gradeLevel}</p>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10 flex-shrink-0"
                              disabled={assignRolesMutation.isPending}
                              onClick={removeStudentAdmin}
                            >
                              <X size={12} /> Remove
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabPanel>

          {/* ── Audit Log Tab ── */}
          <TabPanel value="audit">
            <Card>
              <CardHeader className="border-b pb-4">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <CardTitle className="text-base">Audit Log</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Filter by actor, entity, source, and date range, then inspect the exact context behind a logged action.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border bg-muted/30 p-0.5">
                      <Button
                        variant={auditSubView === 'general' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-3 text-[11px] rounded-md"
                        onClick={() => setAuditSubView('general')}
                      >
                        General
                      </Button>
                      <Button
                        variant={auditSubView === 'flex' ? 'secondary' : 'ghost'}
                        size="sm"
                        className="h-7 px-3 text-[11px] rounded-md"
                        onClick={() => setAuditSubView('flex')}
                      >
                        Flex & Events
                      </Button>
                    </div>
                    {hasActiveAuditFilters ? (
                      <Button type="button" variant="ghost" size="sm" onClick={clearAuditFilters}>
                        <X className="mr-1 size-4" />
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 pt-6">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Search</label>
                    <SearchInput
                      value={auditSearch}
                      onValueChange={setAuditSearch}
                      placeholder="Action, actor, entity…"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Actor</label>
                    <Input
                      value={auditActor}
                      onChange={(e) => setAuditActor(e.target.value)}
                      placeholder="Name or unique ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Entity ID</label>
                    <Input
                      value={auditEntityId}
                      onChange={(e) => setAuditEntityId(e.target.value)}
                      placeholder="Specific record ID"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Source</label>
                    <Select
                      value={auditActorScope}
                      onValueChange={(value) => setAuditActorScope(value as AuditActorScope)}
                    >
                      <SelectTrigger placeholder="Any source" />
                      <SelectContent>
                        <SelectItem index={0} value="ALL">All sources</SelectItem>
                        <SelectItem index={0} value="USER">User actions</SelectItem>
                        <SelectItem index={0} value="SYSTEM">System actions</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Action</label>
                    <Select value={auditActionFilter} onValueChange={setAuditActionFilter}>
                      <SelectTrigger placeholder="Any action" />
                      <SelectContent>
                        <SelectItem index={0} value="ALL">All actions</SelectItem>
                        {auditActionOptions.map((action) => (
                          <SelectItem index={0} key={action} value={action}>
                            {action}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Entity Type</label>
                    <Select value={auditEntityTypeFilter} onValueChange={setAuditEntityTypeFilter}>
                      <SelectTrigger placeholder="Any entity" />
                      <SelectContent>
                        <SelectItem index={0} value="ALL">All entity types</SelectItem>
                        {auditEntityTypeOptions.map((entityType) => (
                          <SelectItem index={0} key={entityType} value={entityType}>
                            {entityType}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">From</label>
                    <DatePicker
                      value={auditStartDate}
                      onChange={setAuditStartDateWithBounds}
                      buttonClassName="w-full"
                      disabledDays={
                        auditEndDate
                          ? (date) => format(date, 'yyyy-MM-dd') > auditEndDate
                          : undefined
                      }
                      allowClear
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">To</label>
                    <DatePicker
                      value={auditEndDate}
                      onChange={setAuditEndDateWithBounds}
                      buttonClassName="w-full"
                      disabledDays={
                        auditStartDate
                          ? (date) => format(date, 'yyyy-MM-dd') < auditStartDate
                          : undefined
                      }
                      allowClear
                    />
                  </div>
                </div>

                {auditFilterChips.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {auditFilterChips.map((chip) => (
                      <Badge key={chip} variant="solid" className="rounded-full px-3 py-1 text-[11px]">
                        {chip}
                      </Badge>
                    ))}
                  </div>
                ) : null}

                <p className="text-xs text-muted-foreground">
                  Showing {displayedAuditEvents.length} matching event{displayedAuditEvents.length === 1 ? '' : 's'}
                  {auditEvents.length >= AUDIT_FETCH_LIMIT ? ` from the latest ${AUDIT_FETCH_LIMIT}` : ''}.
                </p>

                {isAuditLoading ? (
                  <div className="py-12 text-center text-sm text-muted-foreground">
                    Loading audit events…
                  </div>
                ) : displayedAuditEvents.length > 0 ? (
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        {['Time', 'Actor', 'Action', 'Entity', 'Inspect'].map((h) => (
                          <TableHead key={h} className="px-4 py-3 text-xs uppercase tracking-wide">
                            {h}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedAuditEvents.map((event) => {
                        const meta = event.meta ?? {};
                        const contextHint =
                          (typeof meta.clubName === 'string' && typeof meta.channelName === 'string'
                            ? `${meta.clubName} · #${meta.channelName}`
                            : typeof meta.title === 'string'
                              ? meta.title
                              : typeof meta.name === 'string'
                                ? meta.name
                                : typeof meta.bodyPreview === 'string'
                                  ? meta.bodyPreview
                                  : null) ?? null;

                        return (
                          <TableRow key={event.id} className="hover:bg-muted/30">
                            <TableCell className="px-4 py-3 align-top text-xs whitespace-nowrap font-mono text-muted-foreground">
                              {format(new Date(event.createdAt), 'MMM d, yyyy')}
                              <div className="mt-1">{format(new Date(event.createdAt), 'h:mm:ss a')}</div>
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top text-xs">
                              <div className="font-medium text-foreground">
                                {event.actor
                                  ? `${event.actor.firstName} ${event.actor.lastName}`
                                  : 'System'}
                              </div>
                              {event.actor?.uniqueId ? (
                                <div className="mt-1 font-mono text-[11px] text-muted-foreground">
                                  {event.actor.uniqueId}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top">
                              <Badge
                                variant="dot"
                                className="font-mono text-[11px] text-accent-600 dark:text-accent-400"
                              >
                                {event.action}
                              </Badge>
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top text-xs text-muted-foreground">
                              <div className="font-medium text-foreground">
                                {event.entityType}
                                {event.entityId ? ` #${event.entityId.slice(0, 8)}` : ''}
                              </div>
                              {contextHint ? (
                                <div className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted-foreground">
                                  {contextHint}
                                </div>
                              ) : null}
                            </TableCell>
                            <TableCell className="px-4 py-3 align-top">
                              <Button
                                type="button"
                                size="sm"
                                variant="tertiary"
                                className="rounded-xl"
                                onClick={() => setSelectedAuditEventId(event.id)}
                              >
                                <Eye className="mr-1.5 size-4" />
                                Inspect
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-10">
                    <p className="text-muted-foreground text-sm">
                      {hasActiveAuditFilters ? 'No audit events match these filters' : 'No audit events'}
                    </p>
                    {hasActiveAuditFilters ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearAuditFilters}
                        className="mt-1 font-semibold text-accent-500"
                      >
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>

            <Sheet open={!!selectedAuditEventId} onOpenChange={(open) => !open && setSelectedAuditEventId(null)}>
              <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
                <SheetHeader>
                  <SheetTitle>Audit Event Details</SheetTitle>
                  <SheetDescription>
                    Inspect the recorded action, the resolved entity context, and the raw metadata captured at the time.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  {isAuditDetailLoading ? (
                    <div className="text-sm text-muted-foreground">Loading audit context…</div>
                  ) : auditEventDetail ? (
                    <>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Action</p>
                          <p className="mt-2 font-mono text-sm text-foreground">{auditEventDetail.action}</p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">When</p>
                          <p className="mt-2 text-sm text-foreground">
                            {format(new Date(auditEventDetail.createdAt), 'PPP p')}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Actor</p>
                          <p className="mt-2 text-sm text-foreground">
                            {auditEventDetail.actor
                              ? `${auditEventDetail.actor.firstName} ${auditEventDetail.actor.lastName}`
                              : 'System'}
                          </p>
                          {auditEventDetail.actor?.uniqueId ? (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              {auditEventDetail.actor.uniqueId}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Entity</p>
                          <p className="mt-2 text-sm text-foreground">{auditEventDetail.entityType}</p>
                          {auditEventDetail.entityId ? (
                            <p className="mt-1 font-mono text-xs text-muted-foreground">
                              {auditEventDetail.entityId}
                            </p>
                          ) : null}
                        </div>
                      </div>

                      {auditEventDetail.entityPreview ? (
                        <div className="rounded-3xl border border-border/70 bg-card/95 p-5">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                                Resolved context
                              </p>
                              <h3 className="mt-2 text-lg font-semibold text-foreground">
                                {auditEventDetail.entityPreview.title}
                              </h3>
                              {auditEventDetail.entityPreview.subtitle ? (
                                <p className="mt-1 text-sm text-muted-foreground">
                                  {auditEventDetail.entityPreview.subtitle}
                                </p>
                              ) : null}
                            </div>
                            {auditEventDetail.entityPreview.href ? (
                              <Button asChild variant="tertiary" size="sm" className="rounded-xl">
                                <Link href={auditEventDetail.entityPreview.href}>
                                  {auditEventDetail.entityPreview.hrefLabel || 'Open record'}
                                </Link>
                              </Button>
                            ) : null}
                          </div>

                          {auditEventDetail.entityPreview.body ? (
                            <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-4 text-sm leading-6 text-foreground/90">
                              {auditEventDetail.entityPreview.body}
                            </div>
                          ) : null}

                          {auditEventDetail.entityPreview.fields?.length ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              {auditEventDetail.entityPreview.fields.map((field) => (
                                <div key={`${field.label}-${field.value}`} className="rounded-2xl border border-border/70 bg-muted/15 p-3">
                                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                                    {field.label}
                                  </p>
                                  <p className="mt-2 text-sm text-foreground">{field.value}</p>
                                </div>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {auditEventDetail.meta ? (
                        <div className="space-y-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                            Raw metadata
                          </p>
                          <pre className="overflow-x-auto rounded-2xl border border-border/70 bg-muted/20 p-4 text-xs leading-6 text-foreground/80">
                            {JSON.stringify(auditEventDetail.meta, null, 2)}
                          </pre>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      This audit event could not be loaded.
                    </div>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </TabPanel>
        </Tabs>
      </div>
    </AppShell>
  );
}
