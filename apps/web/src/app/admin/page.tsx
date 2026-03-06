'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, moderationApi, auditApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Users, Shield, FileText, Upload, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminPage() {
  const user = getUser();
  const router = useRouter();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
  const [activeTab, setActiveTab] = useState('users');
  const qc = useQueryClient();

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

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await usersApi.importCsv(file);
      toast({ title: `Imported: ${res.data.created} created, ${res.data.skipped} skipped` });
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      toast({ title: err.response?.data?.message || 'Import failed', variant: 'destructive' });
    }
    e.target.value = '';
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
                {hasRole(user, 'SUPER_ADMIN') && (
                  <Button variant="secondary" asChild className="cursor-pointer">
                    <label className="flex items-center gap-2 hover:bg-secondary/80">
                      <Upload size={16} /> Import CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                    </label>
                  </Button>
                )}
              </div>

              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {['ID', 'Name', 'Grade', 'Roles', 'Status', 'Actions'].map((h) => (
                          <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(usersData?.users || []).map((u: any) => (
                        <tr
                          key={u.id}
                          className="border-b transition-colors hover:bg-muted/30 last:border-0"
                        >
                          <td className="py-3 px-4 font-mono text-xs text-muted-foreground">{u.uniqueId}</td>
                          <td className="py-3 px-4 font-medium">{u.firstName} {u.lastName}</td>
                          <td className="py-3 px-4 text-muted-foreground">{u.gradeLevel || '—'}</td>
                          <td className="py-3 px-4">
                            <div className="flex flex-wrap gap-1">
                              {u.roles?.map((r: string) => (
                                <Badge key={r} variant="outline" className="text-[10px]">{r.replace(/_/g, ' ')}</Badge>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={u.isActive ? "default" : "secondary"} className={u.isActive ? "bg-emerald-500/15 text-emerald-500 border-none" : "bg-red-500/15 text-red-500 border-none"}>
                              {u.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            {u.isActive ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deactivateMutation.mutate(u.id)}
                                className="text-xs text-red-500 hover:text-red-400 hover:bg-red-500/10 h-8"
                              >
                                Deactivate
                              </Button>
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
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(usersData?.users || []).length === 0 && (
                    <div className="text-center py-10 text-muted-foreground">No users found.</div>
                  )}
                </div>
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
                <CardHeader className="flex flex-row items-center gap-2 pb-2">
                  <CardTitle className="text-base">Reports</CardTitle>
                  {pendingReports > 0 && (
                    <Badge variant="destructive">{pendingReports} pending</Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  {(reports as any[]).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No reports submitted</p>
                  ) : (
                    <div className="space-y-3">
                      {(reports as any[]).map((r) => (
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
              <CardHeader className="border-b pb-4">
                <CardTitle className="text-base">Recent Audit Events</CardTitle>
              </CardHeader>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      {['Time', 'Actor', 'Action', 'Entity'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-muted-foreground font-medium text-xs uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(auditEvents as any[]).map((e) => (
                      <tr
                        key={e.id}
                        className="border-b transition-colors hover:bg-muted/30 last:border-0"
                      >
                        <td className="py-3 px-4 text-xs text-muted-foreground whitespace-nowrap font-mono">
                          {format(new Date(e.createdAt), 'MMM d HH:mm:ss')}
                        </td>
                        <td className="py-3 px-4 text-xs">
                          {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : '—'}
                        </td>
                        <td className="py-3 px-4 font-mono text-xs text-accent-600 dark:text-accent-400">{e.action}</td>
                        <td className="py-3 px-4 text-xs text-muted-foreground">
                          {e.entityType}{e.entityId ? ` #${e.entityId.slice(0, 8)}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {(auditEvents as any[]).length === 0 && (
                  <div className="text-center py-10 text-muted-foreground">No audit events</div>
                )}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
