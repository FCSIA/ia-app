'use client';

import { useState, useEffect, useDeferredValue, useMemo } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, moderationApi, auditApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, FileText, Upload, Plus, Trash2, CalendarDays, Download, Search, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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
  const user = getUser();
  const router = useRouter();
  const { toast } = useToast();
  const isSuperAdmin = hasRole(user, 'SUPER_ADMIN');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
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
  const qc = useQueryClient();

  // Permission: can current user deactivate this target user?
  const canDeactivate = (targetUser: any) => {
    if (!user) return false;
    const targetRole = targetUser.role || (targetUser.roles?.[0] ?? '');
    const isTargetPrivileged = targetRole === 'ADMIN' || targetRole === 'SUPER_ADMIN';
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

  const { data: usersData } = useQuery({
    queryKey: ['admin-users', page, search],
    queryFn: () => usersApi.getAll(page, 20, search || undefined).then((r) => r.data),
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

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.getAll().then((r) => r.data),
    enabled: activeTab === 'audit',
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

  const filteredAuditEvents = useMemo(() => {
    const query = deferredAuditSearch.trim().toLowerCase();
    if (!query) return auditEvents;
    return (auditEvents as any[]).filter((e) => {
      const searchable = [
        e.action,
        e.entityType,
        e.entityId,
        e.actor?.firstName,
        e.actor?.lastName,
      ].filter(Boolean).join(' ').toLowerCase();
      return searchable.includes(query);
    });
  }, [auditEvents, deferredAuditSearch]);

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

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage users, moderation, and activity logs</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6 bg-secondary/50 p-1">
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users size={16} /> Users
            </TabsTrigger>
            {isSuperAdmin && (
              <TabsTrigger value="schedule" className="flex items-center gap-2">
                <CalendarDays size={16} /> Schedule
              </TabsTrigger>
            )}
            <TabsTrigger value="moderation" className="flex items-center gap-2">
              <Shield size={16} /> Moderation
              {pendingReports > 0 && (
                <Badge variant="destructive" className="ml-1 px-1.5 py-0.5 text-[10px] h-auto">
                  {pendingReports}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="audit" className="flex items-center gap-2">
              <FileText size={16} /> Audit Log
            </TabsTrigger>
          </TabsList>

          {/* ── Users Tab ── */}
          <TabsContent value="users">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Input
                  className="max-w-xs"
                  placeholder="Search users…"
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                />
                {isSuperAdmin && (
                  <p className="text-xs text-muted-foreground">
                    Student roster import/export lives in the Schedule tab.
                  </p>
                )}
              </div>

              <Card>
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      {['ID', 'Name', 'Grade', 'Roles', 'Status', 'Actions'].map((h) => (
                        <TableHead key={h} className="px-4 py-3 text-xs uppercase tracking-wide">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(usersData?.users || []).map((u: any) => (
                      <TableRow key={u.id} className="hover:bg-muted/30">
                        <TableCell className="px-4 py-3 font-mono text-xs text-muted-foreground">{u.uniqueId}</TableCell>
                        <TableCell className="px-4 py-3 font-medium">{u.firstName} {u.lastName}</TableCell>
                        <TableCell className="px-4 py-3 text-muted-foreground">{u.gradeLevel || '—'}</TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            {u.roles?.map((r: string) => (
                              <Badge key={r} variant="outline" className="text-[10px]">{r.replace(/_/g, ' ')}</Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <Badge variant={u.isActive ? "default" : "secondary"} className={u.isActive ? "bg-emerald-500/15 text-emerald-500 border-none" : "bg-red-500/15 text-red-500 border-none"}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          {u.isActive ? (
                            canDeactivate(u) && u.id !== user?.id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deactivateMutation.mutate(u.id)}
                                className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8"
                              >
                                Deactivate
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => activateMutation.mutate(u.id)}
                              className="text-xs text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 h-8"
                            >
                              Activate
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(usersData?.users || []).length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">No users found.</div>
                )}
              </Card>

              {usersData?.total > 20 && (
                <div className="flex justify-center items-center gap-4 mt-2">
                  <Button
                    variant="outline"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Prev
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {Math.ceil(usersData.total / 20)}
                  </span>
                  <Button
                    variant="outline"
                    disabled={page >= Math.ceil(usersData.total / 20)}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              )}
            </div>
          </TabsContent>

          {/* ── Schedule Tab ── */}
          {isSuperAdmin && (
            <TabsContent value="schedule">
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
                          <Badge key={field} variant="outline" className="text-[11px]">
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
                          variant={generatePasswords ? 'default' : 'outline'}
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
            </TabsContent>
          )}

          {/* ── Moderation Tab ── */}
          <TabsContent value="moderation">
            <div className="grid gap-6">
              {/* Keyword filter */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Keyword Filter Rules</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2 mb-6">
                    <Input
                      className="max-w-xs"
                      placeholder="Add keyword…"
                      value={keyword}
                      onChange={(e) => setKeyword(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && keyword.trim()) addKeywordMutation.mutate(keyword.trim());
                      }}
                    />
                    <Button
                      onClick={() => keyword.trim() && addKeywordMutation.mutate(keyword.trim())}
                      className="flex items-center gap-2"
                    >
                      <Plus size={16} /> Add
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(keywords as any[]).map((kw: any) => (
                      <Badge
                        key={kw.id}
                        variant="secondary"
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                      >
                        {kw.keyword}
                        <button
                          onClick={() => removeKeywordMutation.mutate(kw.id)}
                          className="hover:text-red-400 transition-colors ml-1"
                        >
                          <Trash2 size={12} />
                        </button>
                      </Badge>
                    ))}
                    {(keywords as any[]).length === 0 && (
                      <p className="text-muted-foreground text-sm">No keyword rules configured</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Reports */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Reports</CardTitle>
                    {pendingReports > 0 && (
                      <Badge variant="destructive">{pendingReports} pending</Badge>
                    )}
                  </div>
                  <div className="relative w-full max-w-xs">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={moderationSearch}
                      onChange={(e) => setModerationSearch(e.target.value)}
                      className="pl-10 pr-10 h-8 text-xs rounded-lg"
                      placeholder="Search reports..."
                    />
                    {moderationSearch ? (
                      <button
                        type="button"
                        onClick={() => setModerationSearch('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <X className="size-3" />
                      </button>
                    ) : null}
                  </div>
                </CardHeader>
                <CardContent className="pt-4">
                  {filteredReports.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-muted-foreground text-sm">
                        {deferredModerationSearch ? 'No reports match your search' : 'No reports submitted'}
                      </p>
                      {deferredModerationSearch && (
                        <Button variant="link" size="sm" onClick={() => setModerationSearch('')} className="mt-1 font-semibold text-accent-500">
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
                                  r.status === 'PENDING' ? 'default' :
                                    r.status === 'RESOLVED' ? 'outline' : 'secondary'
                                } className={
                                  r.status === 'PENDING' ? 'bg-amber-500/15 text-amber-500 border-none' :
                                    r.status === 'RESOLVED' ? 'text-emerald-500 border-emerald-500/30' : ''
                                }>
                                  {r.status}
                                </Badge>
                                <Badge variant="outline">{r.contentType}</Badge>
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
          </TabsContent>

          {/* ── Audit Log Tab ── */}
          <TabsContent value="audit">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <CardTitle className="text-base">Recent Audit Events</CardTitle>
                <div className="relative w-full max-w-xs ml-4">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    className="pl-10 pr-10 h-8 text-xs rounded-lg"
                    placeholder="Search logs..."
                  />
                  {auditSearch ? (
                    <button
                      type="button"
                      onClick={() => setAuditSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  ) : null}
                </div>
              </CardHeader>
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    {['Time', 'Actor', 'Action', 'Entity'].map((h) => (
                      <TableHead key={h} className="px-4 py-3 text-xs uppercase tracking-wide">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAuditEvents.map((e: any) => (
                    <TableRow key={e.id} className="hover:bg-muted/30">
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap font-mono">
                        {format(new Date(e.createdAt), 'MMM d HH:mm:ss')}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-xs">
                        {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : '—'}
                      </TableCell>
                      <TableCell className="px-4 py-3 font-mono text-xs text-accent-600 dark:text-accent-400">{e.action}</TableCell>
                      <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                        {e.entityType}{e.entityId ? ` #${e.entityId.slice(0, 8)}` : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredAuditEvents.length === 0 && (
                <div className="text-center py-10">
                  <p className="text-muted-foreground text-sm">
                    {deferredAuditSearch ? 'No logs match your search' : 'No audit events'}
                  </p>
                  {deferredAuditSearch && (
                    <Button variant="link" size="sm" onClick={() => setAuditSearch('')} className="mt-1 font-semibold text-accent-500">
                      Clear search
                    </Button>
                  )}
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
