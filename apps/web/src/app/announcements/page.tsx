'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { FeatureFilterBar } from '@/components/filters/feature-filter-bar';
import {
  ANNOUNCEMENT_TAG_LABELS,
  AnnouncementCard,
} from '@/components/announcements/announcement-card';
import { matchesSearchQuery } from '@/lib/search';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

const PATHWAY_OPTIONS = [
  { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
  { value: 'HEALTH_SCIENCE', label: 'Health Science' },
  { value: 'ENGINEERING', label: 'Engineering' },
];

const GRADE_OPTIONS = [9, 10, 11, 12];

const pathwayOptions = PATHWAY_OPTIONS; // Compatibility with filter bar

type ClubFilterOption = {
  id: string;
  name: string;
};

export default function AnnouncementsPage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [showArchived, setShowArchived] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selectedClubIds, setSelectedClubIds] = useState<string[]>([]);
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [savedFilter, setSavedFilter] = useState<'all' | 'saved' | 'pinned'>('all');
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

  const toggleString = (val: string, list: string[], setter: (val: string[]) => void) => {
    setter(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);
  };

  const toggleNumber = (val: number, list: number[], setter: (val: number[]) => void) => {
    setter(list.includes(val) ? list.filter((v) => v !== val) : [...list, val]);
  };

  const updateTargeting = (partial: Partial<typeof form>) => {
    const next = { ...form, ...partial };

    const hasGrades = next.targetGrades.length > 0;
    const hasPathways =
      next.targetMajorPathways.length > 0 || next.targetMinorPathways.length > 0;

    let targetType = 'SCHOOL_WIDE';
    const activeDimensions = [hasGrades, hasPathways].filter(Boolean).length;

    if (activeDimensions > 1) {
      targetType = 'INTERSECTION';
    } else if (hasGrades) {
      targetType = 'GRADE';
    } else if (hasPathways) {
      targetType = 'PATHWAY';
    }

    setForm({ ...next, targetType });
  };

  const canPost = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');
  const canArchiveAny = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canApproveAnnouncements = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');

  const data = useQuery(api.announcements.feed.list, { archived: showArchived });
  const isLoading = data === undefined;

  const createAnnouncement = useMutation(api.announcements.feed.create);
  const archiveAnnouncement = useMutation(api.announcements.engagement.archive);
  const bookmarkAnnouncement = useMutation(api.announcements.engagement.bookmark);
  const unbookmarkAnnouncement = useMutation(api.announcements.engagement.unbookmark);
  const approveAnnouncement = useMutation(api.announcements.feed.approve);
  const rejectAnnouncement = useMutation(api.announcements.feed.reject);

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
      if (announcement.club?._id && announcement.club?.name) {
        clubsById.set(announcement.club._id, {
          id: announcement.club._id,
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
      if (savedFilter === 'pinned' && !announcement.isPinned) return false;
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

  const [createPending, setCreatePending] = useState(false);
  const [approvePending, setApprovePending] = useState<string | null>(null);
  const [rejectPending, setRejectPending] = useState<string | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const isIntersection = form.targetType === 'INTERSECTION';
    setCreatePending(true);
    void createAnnouncement({
      title: form.title,
      body: form.body,
      targetType: form.targetType as
        | 'SCHOOL_WIDE'
        | 'GRADE'
        | 'PATHWAY'
        | 'CLUB'
        | 'INTERSECTION',
      allowComments: form.allowComments,
      isAdminGeneral: form.isAdminGeneral,
      promoted: form.promoted,
      expiresAt: form.expiresAt ? Date.parse(form.expiresAt) : undefined,
      targetGrades: form.targetType === 'GRADE' || isIntersection ? form.targetGrades : [],
      targetMajorPathways:
        form.targetType === 'PATHWAY' || isIntersection ? form.targetMajorPathways : [],
      targetMinorPathways:
        form.targetType === 'PATHWAY' || isIntersection ? form.targetMinorPathways : [],
    })
      .then(() => {
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
      })
      .catch((error: unknown) =>
        toast({
          title: error instanceof Error ? error.message : 'Failed to create',
          variant: 'destructive',
        }),
      )
      .finally(() => setCreatePending(false));
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
            { value: 'pinned', label: 'Pinned', icon: <Sparkles className="size-3" />, color: 'amber' },
            ...availableTags.map((tag) => ({
              value: `tag:${tag}`,
              label: ANNOUNCEMENT_TAG_LABELS[tag] || tag.replace(/_/g, ' '),
              color: tagColor(tag),
            })),
          ]}
          activeChips={[
            ...(readFilter === 'unread' ? ['unread'] : []),
            ...(savedFilter === 'saved' ? ['saved'] : []),
            ...(savedFilter === 'pinned' ? ['pinned'] : []),
            ...(activeTag ? [`tag:${activeTag}`] : []),
          ]}
          onChipToggle={(value) => {
            if (value === 'unread') {
              setReadFilter((current) => (current === 'unread' ? 'all' : 'unread'));
            } else if (value === 'saved' || value === 'pinned') {
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
                    if (value === 'all' || value === 'saved' || value === 'pinned') setSavedFilter(value);
                  }}
                  variant="outline"
                  size="sm"
                >
                  <ToggleGroupItem value="all">Everything</ToggleGroupItem>
                  <ToggleGroupItem value="saved">Saved</ToggleGroupItem>
                  <ToggleGroupItem value="pinned">Pinned</ToggleGroupItem>
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
                <div className="space-y-4">
                  <Label className="text-sm font-semibold">Audience Targeting</Label>

                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">
                        Grades
                      </Label>
                      <div className="flex gap-1.5">
                        {GRADE_OPTIONS.map((grade) => {
                          const active = form.targetGrades.includes(grade);
                          return (
                            <Button
                              key={grade}
                              type="button"
                              variant={active ? 'primary' : 'secondary'}
                              size="sm"
                              className={cn(
                                'h-8 w-10 p-0 rounded-lg transition-all',
                                active && 'ring-2 ring-primary ring-offset-2',
                              )}
                              onClick={() => {
                                const next = active
                                  ? form.targetGrades.filter((g) => g !== grade)
                                  : [...form.targetGrades, grade];
                                updateTargeting({ targetGrades: next });
                              }}
                            >
                              {grade}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-1.5 block">
                        Pathways
                      </Label>
                      <div className="flex flex-wrap gap-1.5">
                        {PATHWAY_OPTIONS.map((p) => {
                          const active = form.targetMajorPathways.includes(p.value);
                          return (
                            <Button
                              key={p.value}
                              type="button"
                              variant={active ? 'primary' : 'secondary'}
                              size="sm"
                              className={cn(
                                'h-8 rounded-lg transition-all',
                                active && 'ring-2 ring-primary ring-offset-2',
                              )}
                              onClick={() => {
                                const next = active
                                  ? form.targetMajorPathways.filter((v) => v !== p.value)
                                  : [...form.targetMajorPathways, p.value];
                                updateTargeting({ targetMajorPathways: next });
                              }}
                            >
                              {p.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {form.targetType !== 'SCHOOL_WIDE' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-[10px] text-muted-foreground hover:text-foreground h-6 px-1.5"
                        onClick={() =>
                          setForm({
                            ...form,
                            targetType: 'SCHOOL_WIDE',
                            targetGrades: [],
                            targetMajorPathways: [],
                            targetMinorPathways: [],
                          })
                        }
                      >
                        Reset to School-wide
                      </Button>
                    )}
                  </div>
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
                      Pin for one month
                    </label>
                  ) : null}
                </div>
                <div className="mt-4 flex gap-2 border-t border-border pt-4">
                  <Button type="submit" disabled={createPending}>
                    {createPending ? 'Posting…' : 'Post Announcement'}
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
              {(filtered as any[]).map((announcement) => {
                const canArchiveAnnouncement =
                  canArchiveAny || announcement.author?._id === user?.id;
                const announcementId = announcement._id as Id<'announcements'>;
                return (
                  <AnnouncementCard
                    key={announcement._id}
                    announcement={announcement}
                    canArchive={canArchiveAnnouncement}
                    onArchive={(id: string) => {
                      void archiveAnnouncement({ announcementId: id as Id<'announcements'> })
                        .then(() => toast({ title: 'Archived' }))
                        .catch((error: unknown) =>
                          toast({
                            title: error instanceof Error ? error.message : 'Failed to archive',
                            variant: 'destructive',
                          }),
                        );
                    }}
                    onBookmarkToggle={(entry) => {
                      const toggle = entry.isBookmarked
                        ? unbookmarkAnnouncement
                        : bookmarkAnnouncement;
                      void toggle({ announcementId: entry._id as Id<'announcements'> }).catch(
                        () => undefined,
                      );
                    }}
                    onTagClick={handleTagClick}
                    onClubClick={(clubId: string) => {
                      setActiveTag('CLUB');
                      setSelectedClubIds([clubId]);
                    }}
                    footer={
                      announcement.status === 'PENDING_APPROVAL' && canApproveAnnouncements ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                          <span className="text-xs text-muted-foreground">
                            Sponsor review required
                          </span>
                          <Button
                            size="sm"
                            disabled={approvePending === announcement._id}
                            onClick={() => {
                              setApprovePending(announcement._id);
                              void approveAnnouncement({ announcementId })
                                .then(() => toast({ title: 'Announcement published' }))
                                .catch((error: unknown) =>
                                  toast({
                                    title:
                                      error instanceof Error ? error.message : 'Failed to publish',
                                    variant: 'destructive',
                                  }),
                                )
                                .finally(() => setApprovePending(null));
                            }}
                          >
                            <Check className="mr-1.5 size-4" />
                            Publish
                          </Button>
                          <Button
                            size="sm"
                            variant="tertiary"
                            disabled={rejectPending === announcement._id}
                            onClick={() => {
                              setRejectPending(announcement._id);
                              void rejectAnnouncement({ announcementId })
                                .then(() => toast({ title: 'Announcement sent back' }))
                                .catch((error: unknown) =>
                                  toast({
                                    title:
                                      error instanceof Error ? error.message : 'Failed to reject',
                                    variant: 'destructive',
                                  }),
                                )
                                .finally(() => setRejectPending(null));
                            }}
                          >
                            <X className="mr-1.5 size-4" />
                            Send back
                          </Button>
                        </div>
                      ) : null
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
