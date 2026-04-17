'use client';

import { useState, useMemo, useDeferredValue } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import { Plus, Archive, MessageCircle, Clock, Search, X, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TAG_COLORS: Record<string, string> = {
  SCHOOL_WIDE: 'bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 border-transparent',
  GRADE: 'bg-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-500/25 border-transparent',
  PATHWAY: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-transparent',
  CLUB: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border-transparent',
};

const TAG_LABELS: Record<string, string> = {
  SCHOOL_WIDE: 'School Wide',
  GRADE: 'Grade',
  PATHWAY: 'Pathway',
  CLUB: 'Club',
};

function AnnouncementCard({
  ann,
  onArchive,
  canArchive,
  onTagClick,
}: {
  ann: any;
  onArchive: (id: string) => void;
  canArchive: boolean;
  onTagClick: (tag: string) => void;
}) {
  return (
    <Card className="hover:-translate-y-0.5 transition-all duration-200">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-2">
              {ann.isAdminGeneral && <Badge variant="destructive" className="text-[10px]">Admin</Badge>}
              {ann.status === 'EXPIRED' && <Badge variant="secondary" className="text-[10px]">Expired</Badge>}
              {ann.status === 'ARCHIVED' && <Badge variant="outline" className="text-[10px]">Archived</Badge>}
              <button type="button" onClick={() => onTagClick(ann.targetType)}>
                <Badge
                  className={`text-[10px] cursor-pointer transition-colors ${TAG_COLORS[ann.targetType] || 'bg-muted text-muted-foreground'}`}
                >
                  {TAG_LABELS[ann.targetType] || ann.targetType.replace(/_/g, ' ')}
                </Badge>
              </button>
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
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [activeTag, setActiveTag] = useState<string | null>(null);
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

  // Derive unique tags from live data for the filter bar
  const availableTags = useMemo(() => {
    if (!data) return [];
    const tags = new Set<string>();
    data.forEach((ann: any) => tags.add(ann.targetType));
    return Array.from(tags).sort();
  }, [data]);

  // Client-side filtering: search + tag
  const filtered = useMemo(() => {
    if (!data) return [];
    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return data.filter((ann: any) => {
      // Tag filter
      if (activeTag && ann.targetType !== activeTag) return false;
      // Search filter
      if (normalizedSearch) {
        const searchable = [
          ann.title,
          ann.body,
          ann.author?.firstName,
          ann.author?.lastName,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedSearch);
      }
      return true;
    });
  }, [data, deferredSearch, activeTag]);

  const handleTagClick = (tag: string) => {
    setActiveTag((prev) => (prev === tag ? null : tag));
  };

  const createMutation = useMutation({
    mutationFn: (d: any) => announcementsApi.create(d),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setShowNew(false);
      setForm({ title: '', body: '', targetType: 'SCHOOL_WIDE', targetGrade: 9, targetPathway: 'INFORMATION_TECHNOLOGY', allowComments: false, isAdminGeneral: false, expiresAt: '' });
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
      targetGrade: form.targetType === 'GRADE' ? Number(form.targetGrade) : undefined,
      targetPathway: form.targetType === 'PATHWAY' ? form.targetPathway : undefined,
    });
  };

  const hasActiveFilters = !!activeTag || !!deferredSearch.trim();

  return (
    <AppShell>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
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

        {/* Search + filter bar */}
        <div className="mb-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-10"
              placeholder="Search announcements..."
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                aria-label="Clear search"
              >
                <X className="size-4" />
              </button>
            )}
          </div>

          {/* Tag filter chips */}
          {availableTags.length > 1 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Filter size={14} className="text-muted-foreground" />
              {availableTags.map((tag) => (
                <button key={tag} type="button" onClick={() => handleTagClick(tag)}>
                  <Badge
                    className={`cursor-pointer text-xs transition-all ${
                      activeTag === tag
                        ? `${TAG_COLORS[tag] || 'bg-muted text-muted-foreground'} ring-2 ring-offset-1 ring-offset-background ring-current`
                        : activeTag
                          ? 'bg-muted/50 text-muted-foreground/60 hover:bg-muted'
                          : `${TAG_COLORS[tag] || 'bg-muted text-muted-foreground'}`
                    }`}
                  >
                    {TAG_LABELS[tag] || tag.replace(/_/g, ' ')}
                  </Badge>
                </button>
              ))}
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={() => { setActiveTag(null); setSearch(''); }}
                  className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 ml-1"
                >
                  <X size={12} /> Clear
                </button>
              )}
            </div>
          )}
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
                        {form.targetType === 'GRADE' ? 'Grade Level' : 'Pathway'}
                      </label>
                      {form.targetType === 'GRADE' ? (
                        <Select
                          value={String(form.targetGrade)}
                          onValueChange={(value) => setForm({ ...form, targetGrade: Number(value) })}
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
                          onValueChange={(value) => setForm({ ...form, targetPathway: value })}
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
              {showArchived ? 'No archived announcements' : 'No announcements yet'}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="text-center py-16 border-dashed">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                No announcements match your {activeTag && search ? 'search and filter' : activeTag ? 'filter' : 'search'}.
              </p>
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => { setActiveTag(null); setSearch(''); }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {hasActiveFilters && (
              <p className="text-xs text-muted-foreground px-1">
                {filtered.length} of {data.length} announcement{data.length === 1 ? '' : 's'}
              </p>
            )}
            {filtered.map((ann: any) => (
              <AnnouncementCard
                key={ann.id}
                ann={ann}
                canArchive={canArchive}
                onArchive={(id: string) => archiveMutation.mutate(id)}
                onTagClick={handleTagClick}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
