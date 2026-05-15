'use client';

import { useState, useEffect, useDeferredValue, useMemo, useRef } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, moderationApi, auditApi, wrappedApi, type WrappedSnapshotStatus } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, FileText, CalendarDays, X, Eye, KeyRound, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { TabsSubtle, TabsSubtleItem } from '@/components/ui/tabs-subtle';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ModerationTab } from '@/components/admin/moderation-tab';
import { PermissionsTab, StudentAdminsTab } from '@/components/admin/permissions-tab';
import { AdminScheduleTab } from '@/components/admin/schedule-tab';
import { AdminUsersTab, UsersPaginationControls } from '@/components/admin/users-tab';
import { WrappedSnapshotsTab } from '@/components/admin/wrapped-snapshots-tab';
import {
  AUDIT_FETCH_LIMIT,
  downloadCsv,
  getDynamicUsersPageSize,
  getUserRoles,
  refreshWrappedResultTitle,
  schoolYearLabel,
  USER_ROLE_GROUP_META,
} from '@/components/admin/admin-utils';
import type {
  AdminUserRecord,
  AdminUserRoleGroup,
  AuditActorScope,
  AuditEventDetail,
  AuditEventRecord,
  StudentImportResult,
} from '@/components/admin/types';
import { cn } from '@/lib/utils';

export default function AdminPage() {
  const user = useCurrentUser();
  const router = useRouter();
  const { toast } = useToast();
  const usersViewportRef = useRef<HTMLDivElement | null>(null);
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const canManageWrapped = hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const currentWrappedSchoolYear = useMemo(() => {
    const now = new Date();
    return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  }, []);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [userRoleGroup, setUserRoleGroup] = useState<AdminUserRoleGroup>('students');
  const [usersPageSize, setUsersPageSize] = useState(10);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const [wrappedSchoolYear, setWrappedSchoolYear] = useState(currentWrappedSchoolYear);
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

  const {
    data: wrappedSnapshotStatus,
    isLoading: isWrappedStatusLoading,
    isError: isWrappedStatusError,
    error: wrappedStatusError,
  } = useQuery<WrappedSnapshotStatus>({
    queryKey: ['wrapped', 'admin', 'snapshots', wrappedSchoolYear],
    queryFn: () => wrappedApi.getSnapshotStatus(wrappedSchoolYear).then((r) => r.data),
    enabled: activeTab === 'wrapped' && canManageWrapped,
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

  const generateWrappedSnapshotsMutation = useMutation({
    mutationFn: (refresh: boolean) =>
      wrappedApi.generateSnapshots({ schoolYear: wrappedSchoolYear, refresh }).then((r) => r.data),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ['wrapped', 'admin', 'snapshots', wrappedSchoolYear] });
      toast({
        title: refreshWrappedResultTitle(result.generated, result.skipped),
        description: `${result.requested} eligible students checked for ${schoolYearLabel(result.schoolYear)}.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: err.response?.data?.message || err.message || 'Wrapped snapshot run failed',
        variant: 'destructive',
      });
    },
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
  const wrappedYearOptions = Array.from({ length: 5 }, (_, index) => currentWrappedSchoolYear - index);
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
    <AppShell mainClassName={activeTab === 'users' ? 'flex-1 overflow-hidden' : undefined}>
      <div className={cn('w-full', activeTab === 'users' && 'flex h-full flex-col overflow-hidden')}>
        {/* Header */}
        <div className="mb-6 shrink-0">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage users, moderation, and activity logs</p>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className={cn('w-full', activeTab === 'users' && 'flex min-h-0 flex-1 flex-col')}
        >
          <TabsList className="mb-6 shrink-0 bg-secondary/50 p-1">
            <TabItem value="users" icon={Users} label="Users" />
            {isSuperAdmin && (
              <TabItem value="schedule" icon={CalendarDays} label="Schedule" />
            )}
            <TabItem
              value="moderation"
              icon={Shield}
              label={pendingReports > 0 ? `Moderation (${pendingReports})` : 'Moderation'}
            />
            <TabItem value="permissions" icon={KeyRound} label="Permissions" />
            <TabItem value="student-admins" icon={Users} label="Student Admins" />
            {canManageWrapped && (
              <TabItem value="wrapped" icon={Sparkles} label="Wrapped" />
            )}
            <TabItem value="audit" icon={FileText} label="Audit Log" />
          </TabsList>

          {/* ── Users Tab ── */}
          <TabPanel value="users" className="mt-0 flex min-h-0 flex-1 flex-col">
            <AdminUsersTab
              search={search}
              onSearchChange={(value) => {
                setSearch(value);
                setPage(1);
              }}
              userRoleGroup={userRoleGroup}
              onUserRoleGroupChange={(value) => {
                setUserRoleGroup(value);
                setPage(1);
              }}
              isSuperAdmin={isSuperAdmin}
              viewportRef={usersViewportRef}
              usersData={usersData}
              isUsersLoading={isUsersLoading}
              isUsersError={isUsersError}
              usersError={usersError}
              refetchUsers={refetchUsers}
              selectedUserRoleMeta={selectedUserRoleMeta}
              currentUserId={user?.id}
              canDeactivate={canDeactivate}
              onDeactivate={(userId) => deactivateMutation.mutate(userId)}
              onActivate={(userId) => activateMutation.mutate(userId)}
              pagination={usersPagination}
            />
          </TabPanel>

          {/* ── Schedule Tab ── */}
          {isSuperAdmin && (
            <TabPanel value="schedule">
              <AdminScheduleTab
                studentCsvInputKey={studentCsvInputKey}
                onStudentCsvFileChange={setStudentCsvFile}
                generatePasswords={generatePasswords}
                onGeneratePasswordsChange={setGeneratePasswords}
                canImport={!!studentCsvFile}
                isImporting={importStudentsMutation.isPending}
                onImport={() => importStudentsMutation.mutate()}
                isExporting={exportStudentsMutation.isPending}
                onExport={() => exportStudentsMutation.mutate()}
                lastStudentImport={lastStudentImport}
                onExportGeneratedPasswords={exportGeneratedPasswords}
              />
            </TabPanel>
          )}

          {/* ── Moderation Tab ── */}
          <TabPanel value="moderation">
            <ModerationTab
              keyword={keyword}
              onKeywordChange={setKeyword}
              keywords={keywords as any[]}
              addKeywordMutation={addKeywordMutation}
              removeKeywordMutation={removeKeywordMutation}
              moderationSearch={moderationSearch}
              onModerationSearchChange={setModerationSearch}
              deferredModerationSearch={deferredModerationSearch}
              filteredReports={filteredReports}
              pendingReports={pendingReports}
              reportMutation={reportMutation}
            />
          </TabPanel>

          {/* ── Permissions Tab ── */}
          <TabPanel value="permissions">
            <PermissionsTab
              search={permSearch}
              onSearchChange={setPermSearch}
              deferredSearch={deferredPermSearch}
              isLoading={isPermUsersLoading}
              users={(permUsersData?.users ?? []) as AdminUserRecord[]}
              isSuperAdmin={isSuperAdmin}
              isPending={assignRolesMutation.isPending}
              onAssignRoles={(payload) => assignRolesMutation.mutate(payload)}
            />
          </TabPanel>

          {/* ── Student Admins Tab ── */}
          <TabPanel value="student-admins">
            <StudentAdminsTab
              search={studentAdminSearch}
              onSearchChange={setStudentAdminSearch}
              deferredSearch={deferredStudentAdminSearch}
              isLoading={isStudentAdminsLoading}
              users={(studentAdminsData?.users ?? []) as AdminUserRecord[]}
              isPending={assignRolesMutation.isPending}
              onAssignRoles={(payload) => assignRolesMutation.mutate(payload)}
            />
          </TabPanel>

          {/* ── Wrapped Tab ── */}
          {canManageWrapped && (
            <TabPanel value="wrapped">
              <WrappedSnapshotsTab
                wrappedSchoolYear={wrappedSchoolYear}
                onWrappedSchoolYearChange={setWrappedSchoolYear}
                wrappedYearOptions={wrappedYearOptions}
                status={wrappedSnapshotStatus}
                isLoading={isWrappedStatusLoading}
                isError={isWrappedStatusError}
                error={wrappedStatusError}
                generateMutation={generateWrappedSnapshotsMutation}
              />
            </TabPanel>
          )}

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
                    <TabsSubtle
                      selectedIndex={auditSubView === 'general' ? 0 : 1}
                      onSelect={(index) => setAuditSubView(index === 0 ? 'general' : 'flex')}
                      className="rounded-full border border-border/70 bg-muted/30 px-1"
                    >
                      <TabsSubtleItem index={0} label="General" className="py-1.5" />
                      <TabsSubtleItem index={1} label="Flex & Events" className="py-1.5" />
                    </TabsSubtle>
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
