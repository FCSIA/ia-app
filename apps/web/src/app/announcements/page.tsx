'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Plus, Archive, MessageCircle, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

function AnnouncementCard({ ann, onArchive, canArchive }: any) {
  return (
    <Card className="hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {ann.isAdminGeneral && <Badge variant="destructive" className="text-[10px]">Admin</Badge>}
              {ann.status === 'EXPIRED' && <Badge variant="secondary" className="text-[10px]">Expired</Badge>}
              {ann.status === 'ARCHIVED' && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
              <Badge variant="default" className="text-[10px] bg-blue-500/15 text-blue-500 hover:bg-blue-500/25 border-transparent">
                {ann.targetType.replace(/_/g, ' ')}
              </Badge>
            </div>
            <Link href={`/announcements/${ann.id}`}>
              <h3 className="font-semibold text-foreground/90 hover:text-accent-500 transition-colors">
                {ann.title}
              </h3>
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              {ann.author?.firstName} {ann.author?.lastName} ·{' '}
              {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
              {ann.expiresAt && (
                <span className="ml-2 text-amber-500 dark:text-amber-400">
                  <Clock size={12} className="inline mr-1" /> expires{' '}
                  {formatDistanceToNow(new Date(ann.expiresAt), { addSuffix: true })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {ann.allowComments && (
              <span className="text-muted-foreground flex items-center gap-1 text-sm bg-secondary px-2 py-1 rounded-md">
                <MessageCircle size={14} /> {ann._count?.comments || 0}
              </span>
            )}
            {canArchive && ann.status === 'ACTIVE' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onArchive(ann.id)}
                className="text-muted-foreground hover:text-foreground h-8 w-8"
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
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    targetType: 'SCHOOL_WIDE',
    targetValue: '',
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
      setForm({ title: '', body: '', targetType: 'SCHOOL_WIDE', targetValue: '', allowComments: false, isAdminGeneral: false, expiresAt: '' });
      toast({ title: 'Announcement created' });
    },
    onError: (e: any) => toast({ title: e.response?.data?.message || 'Failed to create', variant: 'destructive' }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Archived' });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      ...form,
      expiresAt: form.expiresAt || undefined,
      targetValue: form.targetValue || undefined,
    });
  };

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
            <p className="text-muted-foreground text-sm">School-wide and targeted communications</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={showArchived ? 'border-accent-500/50 text-accent-600 dark:text-accent-400' : ''}
            >
              {showArchived ? 'Active' : 'Archived'}
            </Button>
            {canPost && (
              <Button size="sm" onClick={() => setShowNew(true)} className="flex items-center gap-2">
                <Plus size={16} /> New
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Target</label>
                    <Select value={form.targetType} onValueChange={(v) => setForm({ ...form, targetType: v })}>
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
                        {form.targetType === 'GRADE' ? 'Grade (e.g. 9)' : 'Pathway'}
                      </label>
                      <Input
                        placeholder={form.targetType === 'GRADE' ? '9' : 'STEM'}
                        value={form.targetValue}
                        onChange={(e) => setForm({ ...form, targetValue: e.target.value })}
                        required
                      />
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
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      className="accent-accent-500 w-4 h-4 rounded border-input"
                      checked={form.allowComments}
                      onChange={(e) => setForm({ ...form, allowComments: e.target.checked })}
                    />
                    Allow comments
                  </label>
                  {hasRole(user, 'ADMIN', 'SUPER_ADMIN') && (
                    <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                      <input
                        type="checkbox"
                        className="accent-accent-500 w-4 h-4 rounded border-input"
                        checked={form.isAdminGeneral}
                        onChange={(e) => setForm({ ...form, isAdminGeneral: e.target.checked })}
                      />
                      Admin override (notify all)
                    </label>
                  )}
                </div>
                <div className="flex gap-2 pt-4 border-t border-border mt-4">
                  <Button type="submit" disabled={createMutation.isPending}>
                    {createMutation.isPending ? 'Posting…' : 'Post Announcement'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => setShowNew(false)}>
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
          <Card className="text-center py-16 border-dashed">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">{showArchived ? 'No archived announcements' : 'No announcements yet'}</p>
            </CardContent>
          </Card>
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
