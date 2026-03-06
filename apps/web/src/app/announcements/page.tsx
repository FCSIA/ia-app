'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { Plus, Archive, MessageCircle, Clock } from 'lucide-react';
<<<<<<< Updated upstream
=======
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnnouncementTarget, Pathway } from '@/lib/types';
>>>>>>> Stashed changes

function AnnouncementCard({ ann, onArchive, canArchive }: any) {
  return (
    <div className="card hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            {ann.isAdminGeneral && <span className="badge-red">Admin</span>}
            {ann.status === 'EXPIRED' && <span className="badge-gray">Expired</span>}
            {ann.status === 'ARCHIVED' && <span className="badge-gray">Archived</span>}
            <span className="badge-blue">{ann.targetType.replace(/_/g, ' ')}</span>
          </div>
          <Link href={`/announcements/${ann.id}`}>
            <h3 className="font-semibold text-white/90 hover:text-accent-400 transition-colors">
              {ann.title}
            </h3>
          </Link>
          <p className="text-sm text-white/40 mt-1">
            {ann.author?.firstName} {ann.author?.lastName} ·{' '}
            {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
            {ann.expiresAt && (
              <span className="ml-2 text-amber-400">
                <Clock size={12} className="inline" /> expires{' '}
                {formatDistanceToNow(new Date(ann.expiresAt), { addSuffix: true })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {ann.allowComments && (
            <span className="text-white/35 flex items-center gap-1 text-sm">
              <MessageCircle size={14} /> {ann._count?.comments || 0}
            </span>
          )}
          {canArchive && ann.status === 'ACTIVE' && (
            <button
              onClick={() => onArchive(ann.id)}
              className="text-white/30 hover:text-white/70 transition-colors"
              title="Archive"
            >
              <Archive size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnnouncementsPage() {
  const user = getUser();
  const qc = useQueryClient();
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    targetType: 'SCHOOL_WIDE',
    targetGrade: 9,
    targetPathway: 'INFORMATION_TECHNOLOGY',
    allowComments: false,
    isAdminGeneral: false,
    expiresAt: '',
  });

  const canPost = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');
  const canArchive = user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', showArchived],
    queryFn: () => announcementsApi.getAll(showArchived).then((r) => r.data),
  });

  const createMutation = useMutation({
    mutationFn: (d: any) => announcementsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setShowNew(false);
      setForm({ title: '', body: '', targetType: 'SCHOOL_WIDE', targetGrade: 9, targetPathway: 'INFORMATION_TECHNOLOGY', allowComments: false, isAdminGeneral: false, expiresAt: '' });
      toast.success('Announcement created');
    },
    onError: (e: any) => toast.error(e.response?.data?.message || 'Failed to create'),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Archived');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      expiresAt: form.expiresAt || undefined,
      targetGrade: form.targetType === 'GRADE' ? Number(form.targetGrade) : undefined,
      targetPathway: form.targetType === 'PATHWAY' ? form.targetPathway : undefined,
    });
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Announcements</h1>
            <p className="text-white/45 text-sm">School-wide and targeted communications</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`btn-secondary text-sm ${showArchived ? 'border-accent-500/50 text-accent-400' : ''}`}
            >
              {showArchived ? 'Active' : 'Archived'}
            </button>
            {canPost && (
              <button onClick={() => setShowNew(true)} className="btn-primary flex items-center gap-2 text-sm">
                <Plus size={16} /> New
              </button>
            )}
          </div>
        </div>

        {/* New announcement form */}
        {showNew && canPost && (
<<<<<<< Updated upstream
          <div className="card mb-6">
            <h2 className="font-semibold text-white mb-4">New Announcement</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                className="input"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <textarea
                className="input min-h-[100px] resize-y"
                placeholder="Write your announcement..."
                value={form.body}
                onChange={(e) => setForm({ ...form, body: e.target.value })}
                required
              />
              <div className="grid grid-cols-2 gap-3">
=======
          <Card className="mb-6">
            <CardHeader className="pb-3 border-b mb-4">
              <CardTitle className="text-lg">New Announcement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  required
                />
                <Textarea
                  className="min-h-[120px] resize-y"
                  placeholder="Write your announcement..."
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Target</label>
                    <Select value={form.targetType} onValueChange={(v: AnnouncementTarget) => setForm({ ...form, targetType: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SCHOOL_WIDE">School-wide</SelectItem>
                        <SelectItem value="GRADE">Grade</SelectItem>
                        <SelectItem value="PATHWAY">Pathway</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {form.targetType !== 'SCHOOL_WIDE' && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block font-medium">
                        {form.targetType === 'GRADE' ? 'Grade Level' : 'Pathway'}
                      </label>
                      {form.targetType === 'GRADE' ? (
                        <Select
                          value={String(form.targetGrade)}
                          onValueChange={(value: string) => setForm({ ...form, targetGrade: Number(value) })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select grade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="9">9th Grade</SelectItem>
                            <SelectItem value="10">10th Grade</SelectItem>
                            <SelectItem value="11">11th Grade</SelectItem>
                            <SelectItem value="12">12th Grade</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Select
                          value={form.targetPathway}
                          onValueChange={(value: string) => setForm({ ...form, targetPathway: value as Pathway })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select pathway" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="INFORMATION_TECHNOLOGY">Information Technology</SelectItem>
                            <SelectItem value="HEALTH_SCIENCE">Health Science</SelectItem>
                            <SelectItem value="ENGINEERING">Engineering</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  )}
                </div>
>>>>>>> Stashed changes
                <div>
                  <label className="text-xs text-white/45 mb-1 block">Target</label>
                  <select
                    className="input"
                    value={form.targetType}
                    onChange={(e) => setForm({ ...form, targetType: e.target.value })}
                  >
                    <option value="SCHOOL_WIDE">School-wide</option>
                    <option value="GRADE">Grade</option>
                    <option value="PATHWAY">Pathway</option>
                  </select>
                </div>
                {form.targetType !== 'SCHOOL_WIDE' && (
                  <div>
                    <label className="text-xs text-white/45 mb-1 block">
                      {form.targetType === 'GRADE' ? 'Grade Level' : 'Pathway'}
                    </label>
                    {form.targetType === 'GRADE' ? (
                      <select
                        className="input"
                        value={form.targetGrade}
                        onChange={(e) => setForm({ ...form, targetGrade: parseInt(e.target.value, 10) })}
                      >
                        <option value={9}>9th Grade</option>
                        <option value={10}>10th Grade</option>
                        <option value={11}>11th Grade</option>
                        <option value={12}>12th Grade</option>
                      </select>
                    ) : (
                      <select
                        className="input"
                        value={form.targetPathway}
                        onChange={(e) => setForm({ ...form, targetPathway: e.target.value })}
                      >
                        <option value="INFORMATION_TECHNOLOGY">Information Technology</option>
                        <option value="HEALTH_SCIENCE">Health Science</option>
                        <option value="ENGINEERING">Engineering</option>
                      </select>
                    )}
                  </div>
                )}
              </div>
              <div>
                <label className="text-xs text-white/45 mb-1 block">Expires (optional)</label>
                <input
                  type="datetime-local"
                  className="input"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                  <input
                    type="checkbox"
                    className="accent-accent-500"
                    checked={form.allowComments}
                    onChange={(e) => setForm({ ...form, allowComments: e.target.checked })}
                  />
                  Allow comments
                </label>
                {hasRole(user, 'ADMIN', 'SUPER_ADMIN') && (
                  <label className="flex items-center gap-2 text-sm text-white/60 cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-accent-500"
                      checked={form.isAdminGeneral}
                      onChange={(e) => setForm({ ...form, isAdminGeneral: e.target.checked })}
                    />
                    Admin override (notify all)
                  </label>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Posting…' : 'Post Announcement'}
                </button>
                <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Announcements list */}
        {isLoading ? (
          <div className="text-center py-12 text-white/35">Loading…</div>
        ) : !data?.length ? (
          <div className="text-center py-12 text-white/35">
            {showArchived ? 'No archived announcements' : 'No announcements yet'}
          </div>
        ) : (
          <div className="space-y-3">
            {data.map((ann: any) => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                canArchive={canArchive}
                onArchive={(id: string) => archiveMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
