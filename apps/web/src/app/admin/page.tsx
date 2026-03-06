'use client';

import { useState, useEffect } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, moderationApi, auditApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { Users, Shield, FileText, Upload, Plus, Trash2 } from 'lucide-react';

type Tab = 'users' | 'moderation' | 'audit';

export default function AdminPage() {
  const user = getUser();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('users');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState('');
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
    enabled: tab === 'users',
  });

  const { data: keywords = [] } = useQuery({
    queryKey: ['keywords'],
    queryFn: () => moderationApi.getKeywords().then((r) => r.data),
    enabled: tab === 'moderation',
  });

  const { data: reports = [] } = useQuery({
    queryKey: ['reports'],
    queryFn: () => moderationApi.getReports().then((r) => r.data),
    enabled: tab === 'moderation',
  });

  const { data: auditEvents = [] } = useQuery({
    queryKey: ['audit'],
    queryFn: () => auditApi.getAll().then((r) => r.data),
    enabled: tab === 'audit',
  });

  const deactivateMutation = useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Deactivated'); },
  });

  const activateMutation = useMutation({
    mutationFn: (id: string) => usersApi.activate(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin-users'] }); toast.success('Activated'); },
  });

  const addKeywordMutation = useMutation({
    mutationFn: (kw: string) => moderationApi.addKeyword(kw),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keywords'] }); setKeyword(''); toast.success('Keyword added'); },
  });

  const removeKeywordMutation = useMutation({
    mutationFn: (id: string) => moderationApi.removeKeyword(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['keywords'] }); toast.success('Removed'); },
  });

  const reportMutation = useMutation({
    mutationFn: ({ id, status, reviewNote }: any) => moderationApi.updateReport(id, { status, reviewNote }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reports'] }); toast.success('Report updated'); },
  });

  const [showReportForm, setShowReportForm] = useState(false);
  const [reportForm, setReportForm] = useState({ contentType: 'ANNOUNCEMENT', contentId: '', reason: '' });

  const createReportMutation = useMutation({
    mutationFn: (data: any) => moderationApi.submitReport(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reports'] });
      setShowReportForm(false);
      setReportForm({ contentType: 'ANNOUNCEMENT', contentId: '', reason: '' });
      toast.success('Report submitted');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to submit report'),
  });

  const handleCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const res = await usersApi.importCsv(file);
      toast.success(`Imported: ${res.data.created} created, ${res.data.skipped} skipped`);
      qc.invalidateQueries({ queryKey: ['admin-users'] });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Import failed');
    }
    e.target.value = '';
  };

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: 'users', label: 'Users', icon: Users },
    { key: 'moderation', label: 'Moderation', icon: Shield },
    { key: 'audit', label: 'Audit Log', icon: FileText },
  ];

  const pendingReports = (reports as any[]).filter((r: any) => r.status === 'PENDING').length;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold text-white">Admin Panel</h1>
          <p className="text-white/40 text-sm mt-0.5">Manage users, moderation, and activity logs</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-white/[0.08] mb-6">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all duration-200 -mb-px ${
                tab === key
                  ? 'border-accent-500 text-accent-400'
                  : 'border-transparent text-white/45 hover:text-white/70'
              }`}
            >
              <Icon size={15} />
              {label}
              {key === 'moderation' && pendingReports > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-accent-500/20 text-accent-400 border border-accent-500/30">
                  {pendingReports}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Users Tab ── */}
        {tab === 'users' && (
          <div>
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <input
                className="input max-w-xs"
                placeholder="Search users…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {hasRole(user, 'SUPER_ADMIN') && (
                <label className="btn-secondary flex items-center gap-2 text-sm cursor-pointer">
                  <Upload size={15} /> Import CSV
                  <input type="file" accept=".csv" className="hidden" onChange={handleCsvUpload} />
                </label>
              )}
            </div>

            <div className="card overflow-hidden p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                      {['ID', 'Name', 'Grade', 'Roles', 'Status', 'Actions'].map((h) => (
                        <th key={h} className="text-left py-3 px-4 text-white/40 font-medium text-xs uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(usersData?.users || []).map((u: any) => (
                      <tr
                        key={u.id}
                        className="transition-colors duration-150"
                        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                      >
                        <td className="py-3 px-4 font-mono text-xs text-white/50">{u.uniqueId}</td>
                        <td className="py-3 px-4 text-white/80 font-medium">{u.firstName} {u.lastName}</td>
                        <td className="py-3 px-4 text-white/35">{u.gradeLevel || '—'}</td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1">
                            {u.roles?.map((r: string) => (
                              <span key={r} className="badge-blue text-[10px]">{r.replace(/_/g, ' ')}</span>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span className={u.isActive ? 'badge-green' : 'badge-red'}>
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {u.isActive ? (
                            canDeactivate(u) && u.id !== user?.id ? (
                              <button
                                onClick={() => deactivateMutation.mutate(u.id)}
                                className="text-xs text-red-400 hover:text-red-300 transition-colors"
                              >
                                Deactivate
                              </button>
                            ) : (
                              <span className="text-xs text-white/20">—</span>
                            )
                          ) : (
                            <button
                              onClick={() => activateMutation.mutate(u.id)}
                              className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                            >
                              Activate
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {usersData?.total > 20 && (
              <div className="flex justify-center items-center gap-3 mt-5">
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="btn-secondary text-sm py-1.5 px-4"
                >
                  Prev
                </button>
                <span className="text-sm text-white/40">
                  Page {page} of {Math.ceil(usersData.total / 20)}
                </span>
                <button
                  disabled={page >= Math.ceil(usersData.total / 20)}
                  onClick={() => setPage((p) => p + 1)}
                  className="btn-secondary text-sm py-1.5 px-4"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Moderation Tab ── */}
        {tab === 'moderation' && (
          <div className="space-y-5">
            {/* Keyword filter */}
            <div className="card">
              <h2 className="font-semibold text-white/90 mb-4">Keyword Filter Rules</h2>
              <div className="flex gap-2 mb-4">
                <input
                  className="input max-w-xs"
                  placeholder="Add keyword…"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && keyword.trim()) addKeywordMutation.mutate(keyword.trim());
                  }}
                />
                <button
                  onClick={() => keyword.trim() && addKeywordMutation.mutate(keyword.trim())}
                  className="btn-primary flex items-center gap-1 text-sm"
                >
                  <Plus size={14} /> Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {(keywords as any[]).map((kw: any) => (
                  <span
                    key={kw.id}
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-sm"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}
                  >
                    {kw.keyword}
                    <button
                      onClick={() => removeKeywordMutation.mutate(kw.id)}
                      className="hover:text-red-300 transition-colors ml-0.5"
                    >
                      <Trash2 size={11} />
                    </button>
                  </span>
                ))}
                {(keywords as any[]).length === 0 && (
                  <p className="text-white/30 text-sm">No keyword rules configured</p>
                )}
              </div>
            </div>

            {/* Reports */}
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-white/90">
                  Reports{' '}
                  {pendingReports > 0 && (
                    <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-bold bg-accent-500/20 text-accent-400 border border-accent-500/30">
                      {pendingReports} pending
                    </span>
                  )}
                </h2>
                <button
                  onClick={() => setShowReportForm(!showReportForm)}
                  className="btn-primary flex items-center gap-1 text-sm py-1.5"
                >
                  <Plus size={14} /> {showReportForm ? 'Cancel' : 'New Report'}
                </button>
              </div>

              {/* Create Report Form */}
              {showReportForm && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    createReportMutation.mutate(reportForm);
                  }}
                  className="mb-5 p-4 rounded-xl space-y-3"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <h3 className="text-sm font-medium text-white/80">Submit New Report</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-white/45 mb-1 block">Content Type</label>
                      <select
                        className="input"
                        value={reportForm.contentType}
                        onChange={(e) => setReportForm({ ...reportForm, contentType: e.target.value })}
                      >
                        <option value="ANNOUNCEMENT">Announcement</option>
                        <option value="EVENT">Event</option>
                        <option value="CLUB_POST">Club Post</option>
                        <option value="COMMENT">Comment</option>
                        <option value="USER">User</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-white/45 mb-1 block">Content ID</label>
                      <input
                        className="input"
                        placeholder="ID of the reported content"
                        value={reportForm.contentId}
                        onChange={(e) => setReportForm({ ...reportForm, contentId: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-white/45 mb-1 block">Reason</label>
                    <textarea
                      className="input min-h-[80px] resize-y"
                      placeholder="Describe the reason for this report…"
                      value={reportForm.reason}
                      onChange={(e) => setReportForm({ ...reportForm, reason: e.target.value })}
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    className="btn-primary text-sm"
                    disabled={createReportMutation.isPending}
                  >
                    {createReportMutation.isPending ? 'Submitting…' : 'Submit Report'}
                  </button>
                </form>
              )}

              {(reports as any[]).length === 0 ? (
                <p className="text-white/30 text-sm">No reports submitted</p>
              ) : (
                <div className="space-y-3">
                  {(reports as any[]).map((r) => (
                    <div
                      key={r.id}
                      className="rounded-xl p-4 transition-colors"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={
                              r.status === 'PENDING' ? 'badge-yellow' :
                              r.status === 'RESOLVED' ? 'badge-green' : 'badge-gray'
                            }>
                              {r.status}
                            </span>
                            <span className="badge-gray">{r.contentType}</span>
                          </div>
                          <p className="text-sm text-white/70">{r.reason}</p>
                          <p className="text-xs text-white/30 mt-1">
                            Reported by {r.submitter?.firstName} {r.submitter?.lastName}
                            {r.reportedUser && ` · Against: ${r.reportedUser.firstName} ${r.reportedUser.lastName}`}
                          </p>
                        </div>
                        {r.status === 'PENDING' && (
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              onClick={() => reportMutation.mutate({ id: r.id, status: 'RESOLVED', reviewNote: 'Reviewed' })}
                              className="btn-primary text-xs py-1 px-2.5"
                            >
                              Resolve
                            </button>
                            <button
                              onClick={() => reportMutation.mutate({ id: r.id, status: 'DISMISSED', reviewNote: 'Dismissed' })}
                              className="btn-secondary text-xs py-1 px-2.5"
                            >
                              Dismiss
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Audit Log Tab ── */}
        {tab === 'audit' && (
          <div className="card overflow-hidden p-0">
            <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h2 className="font-semibold text-white/90">Recent Audit Events</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                    {['Time', 'Actor', 'Action', 'Entity'].map((h) => (
                      <th key={h} className="text-left py-3 px-4 text-white/40 font-medium text-xs uppercase tracking-wide">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(auditEvents as any[]).map((e) => (
                    <tr
                      key={e.id}
                      className="transition-colors duration-150"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(ev) => (ev.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={(ev) => (ev.currentTarget.style.background = '')}
                    >
                      <td className="py-2.5 px-4 text-xs text-white/35 whitespace-nowrap font-mono">
                        {format(new Date(e.createdAt), 'MMM d HH:mm:ss')}
                      </td>
                      <td className="py-2.5 px-4 text-xs text-white/60">
                        {e.actor ? `${e.actor.firstName} ${e.actor.lastName}` : '—'}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-xs text-accent-400/80">{e.action}</td>
                      <td className="py-2.5 px-4 text-xs text-white/40">
                        {e.entityType}{e.entityId ? ` #${e.entityId.slice(0, 8)}` : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(auditEvents as any[]).length === 0 && (
                <div className="text-center py-10 text-white/30 text-sm">No audit events</div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
