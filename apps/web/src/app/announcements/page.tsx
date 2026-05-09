'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { announcementsApi } from '@/lib/api';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import {
  Bookmark,
  Check,
  Plus,
  Sparkles,
  X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BadgeColor } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  SearchToolbarFilters,
} from '@/components/ui/search';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FeatureFilterBar } from '@/components/filters/feature-filter-bar';
import {
  ANNOUNCEMENT_TAG_LABELS,
  AnnouncementCard,
} from '@/components/announcements/announcement-card';
import { matchesSearchQuery } from '@/lib/search';

type ClubFilterOption = {
  id: string;
  name: string;
};

export default function AnnouncementsPage() {
  const user = useCurrentUser();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [savedFilter, setSavedFilter] = useState<'all' | 'saved' | 'featured'>('all');
  const [selectedGrades, setSelectedGrades] = useState<number[]>([]);
  const [selectedMajorPathways, setSelectedMajorPathways] = useState<string[]>([]);
  const [selectedMinorPathways, setSelectedMinorPathways] = useState<string[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    body: '',
    targetType: 'SCHOOL_WIDE',
    targetGrades: [] as number[],
    targetMajorPathways: [] as string[],
    targetMinorPathways: [] as string[],
    allowComments: false,
    isAdminGeneral: false,
    promoted: false,
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
      if (savedFilter === 'saved' && !announcement.isBookmarked) return false;
      if (savedFilter === 'featured' && !announcement.isFeatured) return false;
      if (
        selectedGrades.length > 0 &&
        !selectedGrades.some((grade) =>
          announcement.targetGrade === grade || announcement.targetGrades?.includes?.(grade),
        )
      ) {
        return false;
      }
      if (
        selectedMajorPathways.length > 0 &&
        !selectedMajorPathways.some((pathway) =>
          announcement.targetPathway === pathway ||
          announcement.targetMajorPathways?.includes?.(pathway),
        )
      ) {
        return false;
      }
      if (
        selectedMinorPathways.length > 0 &&
        !selectedMinorPathways.some((pathway) =>
          announcement.targetMinorPathways?.includes?.(pathway),
        )
      ) {
        return false;
      }

      if (
        selectedClubIds.length > 0 &&
        announcement.clubId &&
        !selectedClubIds.includes(announcement.clubId)
      ) {
        return false;
      }

      return matchesSearchQuery(normalizedSearch, [
        announcement.title,
        announcement.body,
        announcement.author?.firstName,
        announcement.author?.lastName,
        announcement.club?.name,
      ]);
    });
  }, [
    activeTag,
    data,
    deferredSearch,
    readFilter,
    savedFilter,
    selectedClubIds,
    selectedGrades,
    selectedMajorPathways,
    selectedMinorPathways,
  ]);

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
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        allowComments: false,
        isAdminGeneral: false,
        promoted: false,
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

  const bookmarkMutation = useMutation({
    mutationFn: (announcement: any) =>
      announcement.isBookmarked
        ? announcementsApi.unbookmark(announcement.id)
        : announcementsApi.bookmark(announcement.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
    },
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.approve(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Announcement published' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => announcementsApi.reject(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['announcements'] });
      toast({ title: 'Announcement sent back' });
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      ...form,
      expiresAt: form.expiresAt || undefined,
      targetGrades: form.targetType === 'GRADE' ? form.targetGrades : [],
      targetMajorPathways: form.targetType === 'PATHWAY' ? form.targetMajorPathways : [],
      targetMinorPathways: form.targetType === 'PATHWAY' ? form.targetMinorPathways : [],
    });
  };

  const hasActiveFilters =
    !!activeTag ||
    !!deferredSearch.trim() ||
    selectedClubIds.length > 0 ||
    readFilter !== 'all' ||
    savedFilter !== 'all' ||
    selectedGrades.length > 0 ||
    selectedMajorPathways.length > 0 ||
    selectedMinorPathways.length > 0;

  const clearFilters = () => {
    setActiveTag(null);
    setSearch('');
    setSelectedClubIds([]);
    setReadFilter('all');
    setSavedFilter('all');
    setSelectedGrades([]);
    setSelectedMajorPathways([]);
    setSelectedMinorPathways([]);
  };

  const activeFilterCount = [
    activeTag,
    selectedClubIds.length,
    readFilter !== 'all',
    savedFilter !== 'all',
    selectedGrades.length,
    selectedMajorPathways.length,
    selectedMinorPathways.length,
  ].filter(Boolean).length;

  const toggleNumber = (value: number, values: number[], onChange: (values: number[]) => void) => {
    onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  };

  const toggleString = (value: string, values: string[], onChange: (values: string[]) => void) => {
    onChange(values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value]);
  };

  const pathwayOptions = [
    { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
    { value: 'HEALTH_SCIENCE', label: 'Health Science' },
    { value: 'ENGINEERING', label: 'Engineering' },
  ];
  const tagColor = (tag: string): BadgeColor =>
    tag === 'CLUB' ? 'emerald' : tag === 'GRADE' ? 'violet' : tag === 'PATHWAY' ? 'cyan' : 'gray';

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={showArchived ? 'secondary' : 'tertiary'}
              size="sm"
              onClick={() => setShowArchived(!showArchived)}
              className={
                showArchived ? 'border-accent-500/50 text-accent-600 dark:text-accent-400' : ''
              }
            >
              {showArchived ? 'Active' : 'Archived'}
            </Button>
            {canPost ? (
              <Button size="sm" onClick={() => setShowNew(true)} className="flex items-center gap-2">
                <Plus size={16} /> New
              </Button>
            ) : null}
          </div>
        </div>

        <FeatureFilterBar
          className="mb-5"
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search announcements..."
          activeCount={activeFilterCount}
          onClear={clearFilters}
          advancedOpen={filtersOpen}
          onAdvancedOpenChange={setFiltersOpen}
          chips={[
            { value: 'unread', label: 'Unread', color: 'rose' },
            { value: 'saved', label: 'Saved', icon: <Bookmark className="size-3" />, color: 'blue' },
            { value: 'featured', label: 'Featured', icon: <Sparkles className="size-3" />, color: 'amber' },
            ...availableTags.map((tag) => ({
              value: `tag:${tag}`,
              label: ANNOUNCEMENT_TAG_LABELS[tag] || tag.replace(/_/g, ' '),
              color: tagColor(tag),
            })),
          ]}
          activeChips={[
            ...(readFilter === 'unread' ? ['unread'] : []),
            ...(savedFilter === 'saved' ? ['saved'] : []),
            ...(savedFilter === 'featured' ? ['featured'] : []),
            ...(activeTag ? [`tag:${activeTag}`] : []),
          ]}
          onChipToggle={(value) => {
            if (value === 'unread') {
              setReadFilter((current) => (current === 'unread' ? 'all' : 'unread'));
            } else if (value === 'saved' || value === 'featured') {
              setSavedFilter((current) => (current === value ? 'all' : value));
            } else if (value.startsWith('tag:')) {
              handleTagClick(value.slice(4));
            }
          }}
          advanced={
            <div className="flex flex-col gap-4 rounded-md bg-muted/30 p-3">
              <div className="flex flex-wrap gap-2">
                <ToggleGroup
                  type="single"
                  value={readFilter}
                  onValueChange={(value) => {
                    if (value === 'all' || value === 'unread' || value === 'read') setReadFilter(value);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="all">All</ToggleGroupItem>
                  <ToggleGroupItem value="unread">Unread</ToggleGroupItem>
                  <ToggleGroupItem value="read">Read</ToggleGroupItem>
                </ToggleGroup>
                <ToggleGroup
                  type="single"
                  value={savedFilter}
                  onValueChange={(value) => {
                    if (value === 'all' || value === 'saved' || value === 'featured') setSavedFilter(value);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="all">Everything</ToggleGroupItem>
                  <ToggleGroupItem value="saved">Saved</ToggleGroupItem>
                  <ToggleGroupItem value="featured">Featured</ToggleGroupItem>
                </ToggleGroup>
              </div>
              <SearchToolbarFilters>
                {[9, 10, 11, 12].map((grade) => (
                  <Button
                    key={grade}
                    type="button"
                    variant={selectedGrades.includes(grade) ? 'secondary' : 'tertiary'}
                    size="sm"
                    onClick={() => toggleNumber(grade, selectedGrades, setSelectedGrades)}
                  >
                    Grade {grade}
                  </Button>
                ))}
              </SearchToolbarFilters>
              <SearchToolbarFilters>
                {pathwayOptions.map((pathway) => (
                  <Button
                    key={`major-${pathway.value}`}
                    type="button"
                    variant={selectedMajorPathways.includes(pathway.value) ? 'secondary' : 'tertiary'}
                    size="sm"
                    onClick={() =>
                      toggleString(pathway.value, selectedMajorPathways, setSelectedMajorPathways)
                    }
                  >
                    Major: {pathway.label}
                  </Button>
                ))}
              </SearchToolbarFilters>
              <SearchToolbarFilters>
                {pathwayOptions.map((pathway) => (
                  <Button
                    key={`minor-${pathway.value}`}
                    type="button"
                    variant={selectedMinorPathways.includes(pathway.value) ? 'secondary' : 'tertiary'}
                    size="sm"
                    onClick={() =>
                      toggleString(pathway.value, selectedMinorPathways, setSelectedMinorPathways)
                    }
                  >
                    Minor: {pathway.label}
                  </Button>
                ))}
              </SearchToolbarFilters>
              {availableClubs.length > 0 ? (
                <SearchToolbarFilters>
                  {availableClubs.map((club) => (
                    <Button
                      key={club.id}
                      type="button"
                      variant={selectedClubIds.includes(club.id) ? 'secondary' : 'tertiary'}
                      size="sm"
                      onClick={() => toggleString(club.id, selectedClubIds, setSelectedClubIds)}
                    >
                      {club.name}
                    </Button>
                  ))}
                </SearchToolbarFilters>
              ) : null}
            </div>
          }
        />

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
                      <SelectTrigger placeholder="Select target" />
                      <SelectContent>
                        <SelectItem index={0} value="SCHOOL_WIDE">School-wide</SelectItem>
                        <SelectItem index={0} value="GRADE">Grade</SelectItem>
                        <SelectItem index={0} value="PATHWAY">Pathway</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                {form.targetType === 'GRADE' ? (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-medium text-muted-foreground">
                      Grade levels
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[9, 10, 11, 12].map((grade) => (
                        <Button
                          key={grade}
                          type="button"
                          size="sm"
                          variant={form.targetGrades.includes(grade) ? 'secondary' : 'tertiary'}
                          onClick={() =>
                            toggleNumber(grade, form.targetGrades, (targetGrades) =>
                              setForm({ ...form, targetGrades }),
                            )
                          }
                        >
                          Grade {grade}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
                {form.targetType === 'PATHWAY' ? (
                  <div className="flex flex-col gap-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      Pathways
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {pathwayOptions.map((pathway) => (
                        <Button
                          key={`form-major-${pathway.value}`}
                          type="button"
                          size="sm"
                          variant={
                            form.targetMajorPathways.includes(pathway.value)
                              ? 'secondary'
                              : 'tertiary'
                          }
                          onClick={() =>
                            toggleString(
                              pathway.value,
                              form.targetMajorPathways,
                              (targetMajorPathways) => setForm({ ...form, targetMajorPathways }),
                            )
                          }
                        >
                          Major: {pathway.label}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {pathwayOptions.map((pathway) => (
                        <Button
                          key={`form-minor-${pathway.value}`}
                          type="button"
                          size="sm"
                          variant={
                            form.targetMinorPathways.includes(pathway.value)
                              ? 'secondary'
                              : 'tertiary'
                          }
                          onClick={() =>
                            toggleString(
                              pathway.value,
                              form.targetMinorPathways,
                              (targetMinorPathways) => setForm({ ...form, targetMinorPathways }),
                            )
                          }
                        >
                          Minor: {pathway.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                ) : null}
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
                      Push notifications to everyone
                    </label>
                  ) : null}
                  {hasRole(user, 'ADMIN', 'SUPER_ADMIN') ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-accent-500"
                        checked={form.promoted}
                        onChange={(event) =>
                          setForm({ ...form, promoted: event.target.checked })
                        }
                      />
                      Feature for one month
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
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={clearFilters}
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
                  announcement={announcement}
                  canArchive={canArchive}
                  onArchive={(id: string) => archiveMutation.mutate(id)}
                  onBookmarkToggle={(announcement) => bookmarkMutation.mutate(announcement)}
                  onTagClick={handleTagClick}
                  onClubClick={(clubId: string) => {
                    setActiveTag('CLUB');
                    setSelectedClubIds([clubId]);
                  }}
                  footer={
                    announcement.status === 'PENDING_APPROVAL' && canArchive ? (
                      <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                        <span className="text-xs text-muted-foreground">
                          Sponsor review required
                        </span>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(announcement.id)}
                        >
                          <Check className="mr-1.5 size-4" />
                          Publish
                        </Button>
                        <Button
                          size="sm"
                          variant="tertiary"
                          onClick={() => rejectMutation.mutate(announcement.id)}
                        >
                          <X className="mr-1.5 size-4" />
                          Send back
                        </Button>
                      </div>
                    ) : null
                  }
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
