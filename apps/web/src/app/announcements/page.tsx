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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AnnouncementTarget, Pathway } from '@/lib/types';

function AnnouncementCard({ ann, onArchive, canArchive }: any) {
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              {ann.isAdminGeneral && <Badge variant="destructive">Admin</Badge>}
              {ann.status === 'EXPIRED' && <Badge variant="outline">Expired</Badge>}
              {ann.status === 'ARCHIVED' && <Badge variant="outline">Archived</Badge>}
              <Badge variant="secondary">{ann.targetType.replace(/_/g, ' ')}</Badge>
            </div>
            <Link href={`/announcements/${ann.id}`}>
              <h3 className="font-semibold text-foreground hover:text-primary transition-colors">
                {ann.title}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              {ann.author?.firstName} {ann.author?.lastName} ·{' '}
              {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
              {ann.expiresAt && (
                <span className="ml-2 text-amber-500">
                  <Clock size={12} className="inline mr-1" />
                  expires {formatDistanceToNow(new Date(ann.expiresAt), { addSuffix: true })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ann.allowComments && (
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <MessageCircle size={14} /> {ann._count?.comments || 0}
              </span>
            )}
            {canArchive && ann.status === 'ACTIVE' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onArchive(ann.id)}
                title="Archive"
              >
                <Archive size={16} />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
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
    targetType: 'SCHOOL_WIDE' as AnnouncementTarget,
    targetGrade: 9,
    targetPathway: 'INFORMATION_TECHNOLOGY' as Pathway,
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
      <div className="max-w-3xl mx-auto p-4 md:p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Announcements</h1>
            <p className="text-muted-foreground text-sm">School-wide and targeted communications</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={showArchived ? 'border-primary text-primary' : ''}
            >
              {showArchived ? 'View Active' : 'View Archived'}
            </Button>
            {canPost && (
              <Button onClick={() => setShowNew(true)} size="sm">
                <Plus size={16} className="mr-2" /> New
              </Button>
            )}
          </div>
        </div>

        {/* New announcement form */}
        {showNew && canPost && (
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
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Expires (optional)</label>
                  <Input
                    type="datetime-local"
                    value={form.expiresAt}
                    onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      id="allowComments"
                      type="checkbox"
                      className="rounded border-input h-4 w-4"
                      checked={form.allowComments}
                      onChange={(e) => setForm({ ...form, allowComments: e.target.checked })}
                    />
                    <label htmlFor="allowComments" className="text-sm font-medium leading-none cursor-pointer">
                      Allow comments
                    </label>
                  </div>
                  {hasRole(user, 'ADMIN', 'SUPER_ADMIN') && (
                    <div className="flex items-center space-x-2">
                      <input
                        id="isAdminGeneral"
                        type="checkbox"
                        className="rounded border-input h-4 w-4"
                        checked={form.isAdminGeneral}
                        onChange={(e) => setForm({ ...form, isAdminGeneral: e.target.checked })}
                      />
                      <label htmlFor="isAdminGeneral" className="text-sm font-medium leading-none cursor-pointer">
                        Admin override (notify all)
                      </label>
                    </div>
                  )}
                </div>
                <div className="flex gap-2 pt-2">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Posting…' : 'Post Announcement'}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setShowNew(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Announcements list */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            {showArchived ? 'No archived announcements' : 'No announcements yet'}
          </div>
        ) : (
          <div className="space-y-4">
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
