'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api';
import { getUser, hasRole } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  Archive,
  CheckCheck,
  ChevronDown,
  Clock,
  Filter,
  MessageCircle,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { AnnouncementReadToggle } from '@/components/announcements/announcement-read-toggle';

const TAG_COLORS: Record<string, string> = {
  SCHOOL_WIDE:
    'bg-blue-500/15 text-blue-600 dark:text-blue-400 hover:bg-blue-500/25 border-transparent',
  GRADE:
    'bg-violet-500/15 text-violet-600 dark:text-violet-400 hover:bg-violet-500/25 border-transparent',
  PATHWAY:
    'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/25 border-transparent',
  CLUB:
    'bg-amber-500/15 text-amber-600 dark:text-amber-400 hover:bg-amber-500/25 border-transparent',
};

const TAG_LABELS: Record<string, string> = {
  SCHOOL_WIDE: 'School Wide',
  GRADE: 'Grade',
  PATHWAY: 'Pathway',
  CLUB: 'Club',
};

const BADGE_TEXT_CLASS = 'text-[11px]';

type ClubFilterOption = {
  id: string;
  name: string;
};

function ClubMultiSelect({
  clubs,
  selectedClubIds,
  onChange,
}: {
  clubs: ClubFilterOption[];
  selectedClubIds: string[];
  onChange: (value: string[]) => void;
}) {
  const selectedNames = clubs
    .filter((club) => selectedClubIds.includes(club.id))
    .map((club) => club.name);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="justify-between rounded-xl">
          <span className="truncate">
            {selectedNames.length > 0
              ? `Clubs: ${selectedNames.join(', ')}`
              : 'Filter clubs'}
          </span>
          <ChevronDown className="ml-2 size-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <Command>
          <CommandInput placeholder="Search clubs..." />
          <CommandList>
            <CommandEmpty>No clubs found.</CommandEmpty>
            <CommandGroup>
              {clubs.map((club) => {
                const checked = selectedClubIds.includes(club.id);
                return (
                  <CommandItem
                    key={club.id}
                    value={club.name}
                    onSelect={() =>
                      onChange(
                        checked
                          ? selectedClubIds.filter((id) => id !== club.id)
                          : [...selectedClubIds, club.id],
                      )
                    }
                  >
                    <Checkbox checked={checked} className="mr-2" />
                    <span className="flex-1">{club.name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        <div className="flex items-center justify-between border-t px-3 py-2">
          <p className="text-xs text-muted-foreground">
            Non-club announcements stay visible.
          </p>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onChange([])}
            disabled={selectedClubIds.length === 0}
          >
            Clear
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function AnnouncementCard({
  ann,
  onArchive,
  canArchive,
  onTagClick,
  onClubClick,
}: {
  ann: any;
  onArchive: (id: string) => void;
  canArchive: boolean;
  onTagClick: (tag: string) => void;
  onClubClick: (clubId: string) => void;
}) {
  return (
    <div
      className="relative rounded-[1.4rem] border border-border/70 bg-background/85 px-5 py-4 transition hover:-translate-y-0.5 hover:border-border hover:bg-muted/60"
    >
      {!ann.isRead ? (
        <span className="absolute right-4 top-4 size-2 rounded-full bg-primary" />
      ) : null}
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {ann.isAdminGeneral ? (
                <Badge variant="destructive" className={BADGE_TEXT_CLASS}>
                  Admin
                </Badge>
              ) : null}
              {ann.status === 'EXPIRED' ? (
                <Badge variant="secondary" className={BADGE_TEXT_CLASS}>
                  Expired
                </Badge>
              ) : null}
              {ann.status === 'ARCHIVED' ? (
                <Badge variant="outline" className={BADGE_TEXT_CLASS}>
                  Archived
                </Badge>
              ) : null}
              <button
                type="button"
                className="cursor-pointer"
                onClick={() => onTagClick(ann.targetType)}
              >
                <Badge
                  className={`${BADGE_TEXT_CLASS} transition-colors ${TAG_COLORS[ann.targetType] || 'bg-muted text-muted-foreground'}`}
                >
                  {TAG_LABELS[ann.targetType] || ann.targetType.replace(/_/g, ' ')}
                </Badge>
              </button>
              {ann.club?.name ? (
                <button
                  type="button"
                  className="cursor-pointer"
                  onClick={() => onClubClick(ann.club.id)}
                >
                  <Badge variant="outline" className={BADGE_TEXT_CLASS}>
                    {ann.club.name}
                  </Badge>
                </button>
              ) : null}
            </div>

            <Link href={`/announcements/${ann.id}`}>
              <h3 className="font-semibold text-foreground/90 transition-colors hover:text-accent-500">
                {ann.title}
              </h3>
            </Link>

            <p className="mt-2 line-clamp-2 text-sm leading-6 text-muted-foreground">
              {ann.body}
            </p>

            <p className="mt-3 text-sm text-muted-foreground">
              {ann.author?.firstName} {ann.author?.lastName} ·{' '}
              {formatDistanceToNow(new Date(ann.createdAt), { addSuffix: true })}
              {ann.expiresAt ? (
                <span className="ml-2 text-amber-500 dark:text-amber-400">
                  <Clock size={12} className="mr-1 inline" />
                  expires {formatDistanceToNow(new Date(ann.expiresAt), { addSuffix: true })}
                </span>
              ) : null}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-2">
            {ann.allowComments ? (
              <span className="flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-sm text-muted-foreground">
                <MessageCircle size={14} /> {ann._count?.comments || 0}
              </span>
            ) : null}
            <AnnouncementReadToggle announcementId={ann.id} isRead={ann.isRead} />
            {canArchive && ann.status === 'ACTIVE' ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onArchive(ann.id)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
                title="Archive"
              >
                <Archive size={16} />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
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
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
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

  const canPost = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');
  const canArchive = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', showArchived],
    queryFn: () => announcementsApi.getAll(showArchived).then((response) => response.data),
  });

  const availableTags = useMemo(() => {
    if (!data) return [];
    const tags = new Set<string>();
    data.forEach((announcement: any) => tags.add(announcement.targetType));
    return Array.from(tags).sort();
  }, [data]);

  const availableClubs = useMemo<ClubFilterOption[]>(() => {
    if (!data) return [];
    const clubsById = new Map<string, ClubFilterOption>();

    data.forEach((announcement: any) => {
      if (announcement.club?.id && announcement.club?.name) {
        clubsById.set(announcement.club.id, {
          id: announcement.club.id,
          name: announcement.club.name,
        });
      }
    });

    return Array.from(clubsById.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];

    const normalizedSearch = deferredSearch.trim().toLowerCase();
    return data.filter((announcement: any) => {
      if (activeTag && announcement.targetType !== activeTag) return false;
      if (readFilter === 'unread' && announcement.isRead) return false;
      if (readFilter === 'read' && !announcement.isRead) return false;

      if (
        selectedClubIds.length > 0 &&
        announcement.clubId &&
        !selectedClubIds.includes(announcement.clubId)
      ) {
        return false;
      }

      if (normalizedSearch) {
        const searchable = [
          announcement.title,
          announcement.body,
          announcement.author?.firstName,
          announcement.author?.lastName,
          announcement.club?.name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();

        return searchable.includes(normalizedSearch);
      }

      return true;
    });
  }, [activeTag, data, deferredSearch, readFilter, selectedClubIds]);

  const handleTagClick = (tag: string) => {
    setActiveTag((current) => (current === tag ? null : tag));
  };

  const createMutation = useMutation({
    mutationFn: (payload: any) => announcementsApi.create(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      setShowNew(false);
      setForm({
        title: '',
        body: '',
        targetType: 'SCHOOL_WIDE',
        targetGrade: 9,
        targetPathway: 'INFORMATION_TECHNOLOGY',
        allowComments: false,
        isAdminGeneral: false,
        expiresAt: '',
      });
      toast({ title: 'Announcement created' });
    },
    onError: (error: any) =>
      toast({
        title: error.response?.data?.message || 'Failed to create',
        variant: 'destructive',
      }),
  });

  const archiveMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.archive(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Archived' });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      expiresAt: form.expiresAt || undefined,
      targetGrade: form.targetType === 'GRADE' ? Number(form.targetGrade) : undefined,
      targetPathway: form.targetType === 'PATHWAY' ? form.targetPathway : undefined,
    });
  };

  const hasActiveFilters =
    !!activeTag || !!deferredSearch.trim() || selectedClubIds.length > 0 || readFilter !== 'all';

  const headerSlot = (
    <div className="flex min-w-0 flex-1 items-center justify-between gap-3">
      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">Announcements</h1>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          variant={showArchived ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? 'Active' : 'Archived'}
        </Button>
        {canPost ? (
          <Button size="sm" onClick={() => setShowNew(true)}>
            <Plus className="mr-1.5 size-4" /> New
          </Button>
        ) : null}
      </div>
    </div>
  );

  return (
    <AppShell headerSlot={headerSlot}>
      <div className="mx-auto max-w-4xl">

        <div className="mb-5 space-y-3">
          <div className="border-b pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-11 border-0 bg-transparent pl-9 pr-9 text-base shadow-none focus-visible:ring-0"
                placeholder="Search announcements..."
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              value={readFilter}
              onValueChange={(value) => {
                if (value === 'all' || value === 'unread' || value === 'read') {
                  setReadFilter(value);
                }
              }}
              variant="outline"
              size="sm"
              className="rounded-xl border border-border/70 bg-background/80 p-1"
            >
              <ToggleGroupItem value="all" className="rounded-lg px-3">
                All
              </ToggleGroupItem>
              <ToggleGroupItem value="unread" className="rounded-lg px-3">
                Unread
              </ToggleGroupItem>
              <ToggleGroupItem value="read" className="rounded-lg px-3">
                Read
              </ToggleGroupItem>
            </ToggleGroup>

            {availableTags.length > 1 ? (
              <div className="flex items-center gap-2 rounded-xl border border-border/70 bg-background/80 px-3 py-2">
                <Filter size={14} className="text-muted-foreground" />
                <div className="flex flex-wrap gap-2">
                  {availableTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => handleTagClick(tag)}>
                      <Badge
                        className={`${BADGE_TEXT_CLASS} cursor-pointer transition-all ${
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
                </div>
              </div>
            ) : null}

            {availableClubs.length > 0 ? (
              <ClubMultiSelect
                clubs={availableClubs}
                selectedClubIds={selectedClubIds}
                onChange={setSelectedClubIds}
              />
            ) : null}

            {hasActiveFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  setActiveTag(null);
                  setSearch('');
                  setSelectedClubIds([]);
                  setReadFilter('all');
                }}
              >
                <X className="mr-1 size-4" />
                Clear filters
              </Button>
            ) : null}
          </div>

          {selectedClubIds.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {availableClubs
                .filter((club) => selectedClubIds.includes(club.id))
                .map((club) => (
                  <Badge key={club.id} variant="secondary" className={`gap-1 ${BADGE_TEXT_CLASS}`}>
                    {club.name}
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-background/70"
                      onClick={() =>
                        setSelectedClubIds((current) =>
                          current.filter((clubId) => clubId !== club.id),
                        )
                      }
                    >
                      <X className="size-3" />
                    </button>
                  </Badge>
                ))}
            </div>
          ) : null}
        </div>

        {showNew && canPost ? (
          <Card className="mb-6">
            <CardHeader className="mb-4 border-b pb-3">
              <CardTitle className="text-lg">New Announcement</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  placeholder="Title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  required
                />
                <Textarea
                  className="min-h-[120px] resize-y"
                  placeholder="Write your announcement..."
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  required
                />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      Target
                    </label>
                    <Select
                      value={form.targetType}
                      onValueChange={(value) => setForm({ ...form, targetType: value })}
                    >
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
                  {form.targetType !== 'SCHOOL_WIDE' ? (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                        {form.targetType === 'GRADE' ? 'Grade level' : 'Pathway'}
                      </label>
                      {form.targetType === 'GRADE' ? (
                        <Select
                          value={String(form.targetGrade)}
                          onValueChange={(value) =>
                            setForm({ ...form, targetGrade: Number(value) })
                          }
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
                            <SelectItem value="INFORMATION_TECHNOLOGY">
                              Information Technology
                            </SelectItem>
                            <SelectItem value="HEALTH_SCIENCE">Health Science</SelectItem>
                            <SelectItem value="ENGINEERING">Engineering</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  ) : null}
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                    Expires (optional)
                  </label>
                  <DateTimePicker
                    value={form.expiresAt}
                    onChange={(expiresAt) => setForm({ ...form, expiresAt })}
                    allowClear
                  />
                </div>
                <div className="flex items-center gap-6 pt-2">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-accent-500"
                      checked={form.allowComments}
                      onChange={(event) =>
                        setForm({ ...form, allowComments: event.target.checked })
                      }
                    />
                    Allow comments
                  </label>
                  {hasRole(user, 'ADMIN', 'SUPER_ADMIN') ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-accent-500"
                        checked={form.isAdminGeneral}
                        onChange={(event) =>
                          setForm({ ...form, isAdminGeneral: event.target.checked })
                        }
                      />
                      Admin override (notify all)
                    </label>
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
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
        ) : null}

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <Card className="border-dashed py-16 text-center">
            <CardContent className="pt-6">
              {showArchived ? 'No archived announcements' : 'No announcements yet'}
            </CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed py-16 text-center">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">
                No announcements match your filters.
              </p>
              <Button
                variant="link"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setActiveTag(null);
                  setSearch('');
                  setSelectedClubIds([]);
                }}
              >
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {hasActiveFilters ? (
              <p className="px-1 text-xs text-muted-foreground">
                {filtered.length} of {data.length} announcement{data.length === 1 ? '' : 's'}
              </p>
            ) : null}
            <div className="space-y-4">
              {(filtered as any[]).map((announcement) => (
                <AnnouncementCard
                  key={announcement.id}
                  ann={announcement}
                  canArchive={canArchive}
                  onArchive={(id: string) => archiveMutation.mutate(id)}
                  onTagClick={handleTagClick}
                  onClubClick={(clubId: string) => {
                    setActiveTag('CLUB');
                    setSelectedClubIds([clubId]);
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
