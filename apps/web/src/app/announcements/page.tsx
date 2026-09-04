'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAction, useMutation, useQuery } from 'convex/react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Archive, Check, ChevronDown, Inbox, Plus, SlidersHorizontal, X } from 'lucide-react';
import { Card, CardContent, CardGroup } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { SearchInput } from '@/components/ui/search';
import { Textarea } from '@/components/ui/textarea';
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { ANNOUNCEMENT_TAG_LABELS, AnnouncementCard } from '@/components/announcements/announcement-card';
import { matchesSearchQuery } from '@/lib/search';
import { CARD_SURFACE_FOREGROUND } from '@/lib/surface-classes';
import { Label } from '@/components/ui/label';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { TabItem, Tabs, TabsList } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AnnouncementMediaInput } from '@/components/announcements/announcement-media';
import { uploadFileToConvex } from '@/lib/convex-upload';

const PATHWAY_OPTIONS = [
  { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
  { value: 'HEALTH_SCIENCE', label: 'Health Science' },
  { value: 'ENGINEERING', label: 'Engineering' },
];

const GRADE_OPTIONS = [9, 10, 11, 12];
const MAX_ANNOUNCEMENT_TITLE_CHARACTERS = 160;
const MAX_ANNOUNCEMENT_BODY_CHARACTERS = 10_000;

const ANNOUNCEMENT_SCOPE_LABELS: Record<string, string> = {
  ...ANNOUNCEMENT_TAG_LABELS,
  INTERSECTION: 'Combined audience',
};

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
  const [audienceMode, setAudienceMode] = useState<'SCHOOL_WIDE' | 'TARGETED'>('SCHOOL_WIDE');
  const [images, setImages] = useState<File[]>([]);
  const [embedUrls, setEmbedUrls] = useState<string[]>([]);
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

  const updateTargeting = (partial: Partial<typeof form>) => {
    const next = { ...form, ...partial };

    const hasGrades = next.targetGrades.length > 0;
    const hasPathways = next.targetMajorPathways.length > 0 || next.targetMinorPathways.length > 0;

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

  const canPost = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER', 'STUDENT_ADMIN');
  const canArchiveAny = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canApproveAnnouncements = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');

  const data = useQuery(api.announcements.feed.list, {
    archived: showArchived,
  });
  const isLoading = data === undefined;

  const createAnnouncement = useMutation(api.announcements.feed.create);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeAnnouncementImage = useAction(api.uploads.files.finalizeAnnouncementImage);
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

    return Array.from(clubsById.values()).sort((left, right) => left.name.localeCompare(right.name));
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
      if (selectedGrades.length > 0 && !selectedGrades.some((grade) => announcement.targetGrade === grade || announcement.targetGrades?.includes?.(grade))) {
        return false;
      }
      if (
        selectedMajorPathways.length > 0 &&
        !selectedMajorPathways.some((pathway) => announcement.targetPathway === pathway || announcement.targetMajorPathways?.includes?.(pathway))
      ) {
        return false;
      }
      if (selectedMinorPathways.length > 0 && !selectedMinorPathways.some((pathway) => announcement.targetMinorPathways?.includes?.(pathway))) {
        return false;
      }

      if (selectedClubIds.length > 0 && !selectedClubIds.includes(announcement.clubId ?? '')) {
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
  }, [activeTag, data, deferredSearch, readFilter, savedFilter, selectedClubIds, selectedGrades, selectedMajorPathways, selectedMinorPathways]);

  const [createPending, setCreatePending] = useState(false);
  const [reviewPending, setReviewPending] = useState<{
    id: string;
    action: 'approve' | 'reject';
  } | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (createPending) return;
    const isIntersection = form.targetType === 'INTERSECTION';
    setCreatePending(true);
    try {
      const imageUploadIds = await Promise.all(images.map(async (file) => {
        const { storageId, uploadIntentId } = await uploadFileToConvex(
          { generateUploadUrl: () => generateUploadUrl({ purpose: 'ANNOUNCEMENT_IMAGE' }) },
          file,
        );
        return (await finalizeAnnouncementImage({ storageId, uploadIntentId })).imageUploadId;
      }));
      await createAnnouncement({
        title: form.title,
        body: form.body,
        targetType: form.targetType as 'SCHOOL_WIDE' | 'GRADE' | 'PATHWAY' | 'CLUB' | 'INTERSECTION',
        allowComments: form.allowComments,
        isAdminGeneral: form.isAdminGeneral,
        promoted: form.promoted,
        expiresAt: form.expiresAt ? Date.parse(form.expiresAt) : undefined,
        targetGrades: form.targetType === 'GRADE' || isIntersection ? form.targetGrades : [],
        targetMajorPathways: form.targetType === 'PATHWAY' || isIntersection ? form.targetMajorPathways : [],
        targetMinorPathways: form.targetType === 'PATHWAY' || isIntersection ? form.targetMinorPathways : [],
        imageUploadIds,
        embedUrls,
      });
      setShowNew(false);
      setImages([]);
      setEmbedUrls([]);
      setForm({
        title: '', body: '', targetType: 'SCHOOL_WIDE', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [],
        allowComments: false, isAdminGeneral: false, promoted: false, expiresAt: '',
      });
      setAudienceMode('SCHOOL_WIDE');
      toast({ title: 'Announcement created' });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : 'Failed to create', variant: 'destructive' });
    } finally {
      setCreatePending(false);
    }
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
    setSearch('');
    resetFacetFilters();
  };

  const resetFacetFilters = () => {
    setActiveTag(null);
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

  return (
    <AppShell
      headerSlot={
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
          Announcements
        </h1>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        <div className={`rounded-2xl bg-surface-2 p-5 shadow-surface-1 border border-border/50 space-y-4 ${CARD_SURFACE_FOREGROUND}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 overflow-x-auto">
              <Tabs value={showArchived ? 'archived' : 'active'} onValueChange={(value) => setShowArchived(value === 'archived')}>
                <TabsList aria-label="Announcement view">
                  <TabItem value="active" label="Active" icon={Inbox} />
                  <TabItem value="archived" label="Archived" icon={Archive} />
                </TabsList>
              </Tabs>
            </div>
            {canPost ? (
              <Button
                size="sm"
                leadingIcon={Plus}
                onClick={() => {
                  setShowArchived(false);
                  setShowNew(true);
                }}
              >
                New
              </Button>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <SearchInput value={search} onValueChange={setSearch} placeholder="Search announcements" size="sm" className="min-w-0 flex-1" />
            <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button variant="tertiary" leadingIcon={SlidersHorizontal} active={filtersOpen}>
                Filters
                {activeFilterCount > 0 ? (
                  <Badge size="sm" color="blue">
                    {activeFilterCount}
                  </Badge>
                ) : null}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-[min(44rem,calc(100vw-2rem))] overflow-hidden p-0"
              aria-labelledby="announcement-filters-title"
            >
              <div className="max-h-[min(38rem,var(--radix-popover-content-available-height))] overflow-y-auto p-3">
                <div className="mb-2 flex items-baseline justify-between gap-3">
                  <h3 id="announcement-filters-title" className="text-sm font-semibold text-foreground">
                    Filters
                  </h3>
                  {activeFilterCount > 0 ? (
                    <Button variant="ghost" size="sm" onClick={resetFacetFilters}>
                      Reset
                    </Button>
                  ) : null}
                </div>

                <div className="grid gap-x-8 gap-y-3 md:grid-cols-2">
                <FieldSet className="min-w-0 gap-0">
                  <FieldLegend variant="label">Read state</FieldLegend>
                  <RadioGroup value={readFilter} onValueChange={(value) => setReadFilter(value as 'all' | 'unread' | 'read')} orientation="horizontal" className="w-full flex-wrap">
                    {['all', 'unread', 'read'].map((value, index) => (
                      <RadioItem key={value} index={index} value={value} label={value === 'all' ? 'Any' : value === 'unread' ? 'Unread' : 'Read'} className="min-w-[calc(50%-0.125rem)] flex-1" />
                    ))}
                  </RadioGroup>
                </FieldSet>

                <FieldSet className="min-w-0 gap-0">
                  <FieldLegend variant="label">Saved state</FieldLegend>
                  <RadioGroup value={savedFilter} onValueChange={(value) => setSavedFilter(value as 'all' | 'saved' | 'pinned')} orientation="horizontal" className="w-full flex-wrap">
                    {['all', 'saved', 'pinned'].map((value, index) => (
                      <RadioItem key={value} index={index} value={value} label={value === 'all' ? 'Any' : value === 'saved' ? 'Saved' : 'Pinned'} className="min-w-[calc(50%-0.125rem)] flex-1" />
                    ))}
                  </RadioGroup>
                </FieldSet>

                {availableTags.length > 0 ? (
                  <FieldSet className="min-w-0 gap-0">
                    <FieldLegend variant="label">Audience scope</FieldLegend>
                    <RadioGroup value={activeTag ?? 'all'} onValueChange={(value) => setActiveTag(value === 'all' ? null : value)} orientation="horizontal" className="w-full flex-wrap">
                      {['all', ...availableTags].map((tag, index) => (
                        <RadioItem
                          key={tag}
                          index={index}
                          value={tag}
                          label={tag === 'all' ? 'Any' : ANNOUNCEMENT_SCOPE_LABELS[tag] || tag.replace(/_/g, ' ')}
                          className="min-w-[calc(50%-0.125rem)] flex-1"
                        />
                      ))}
                    </RadioGroup>
                  </FieldSet>
                ) : null}

                <FieldSet className="min-w-0 gap-0">
                  <FieldLegend variant="label">Grade</FieldLegend>
                  <CheckboxGroup
                    checkedIndices={new Set(GRADE_OPTIONS.flatMap((grade, index) => (selectedGrades.includes(grade) ? [index] : [])))}
                    className="w-full"
                  >
                    {GRADE_OPTIONS.map((grade, index) => (
                      <CheckboxItem
                        key={grade}
                        index={index}
                        label={`Grade ${grade}`}
                        checked={selectedGrades.includes(grade)}
                        onToggle={() =>
                          setSelectedGrades((current) => (current.includes(grade) ? current.filter((value) => value !== grade) : [...current, grade]))
                        }
                      />
                    ))}
                  </CheckboxGroup>
                </FieldSet>

                {[
                  {
                    label: 'Major pathway',
                    selected: selectedMajorPathways,
                    setSelected: setSelectedMajorPathways,
                  },
                  {
                    label: 'Minor pathway',
                    selected: selectedMinorPathways,
                    setSelected: setSelectedMinorPathways,
                  },
                ].map(({ label, selected, setSelected }) => (
                  <FieldSet key={label} className="min-w-0 gap-0">
                    <FieldLegend variant="label">{label}</FieldLegend>
                    <CheckboxGroup
                      checkedIndices={new Set(PATHWAY_OPTIONS.flatMap((pathway, index) => (selected.includes(pathway.value) ? [index] : [])))}
                      className="w-full"
                    >
                      {PATHWAY_OPTIONS.map((pathway, index) => (
                        <CheckboxItem
                          key={pathway.value}
                          index={index}
                          label={pathway.label}
                          checked={selected.includes(pathway.value)}
                          onToggle={() =>
                            setSelected((current) =>
                              current.includes(pathway.value) ? current.filter((value) => value !== pathway.value) : [...current, pathway.value],
                            )
                          }
                        />
                      ))}
                    </CheckboxGroup>
                  </FieldSet>
                ))}

                {availableClubs.length > 0 ? (
                  <FieldSet className="min-w-0 gap-0 md:col-span-2">
                    <FieldLegend variant="label">Club</FieldLegend>
                    <CheckboxGroup
                      checkedIndices={new Set(availableClubs.flatMap((club, index) => (selectedClubIds.includes(club.id) ? [index] : [])))}
                      className="w-full"
                    >
                      {availableClubs.map((club, index) => (
                        <CheckboxItem
                          key={club.id}
                          index={index}
                          label={club.name}
                          checked={selectedClubIds.includes(club.id)}
                          onToggle={() =>
                            setSelectedClubIds((current) => (current.includes(club.id) ? current.filter((value) => value !== club.id) : [...current, club.id]))
                          }
                        />
                      ))}
                    </CheckboxGroup>
                  </FieldSet>
                ) : null}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

        <Dialog open={showNew} onOpenChange={setShowNew}>
          <DialogContent size="lg" className="max-h-[min(48rem,calc(100vh-2rem))] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>New announcement</DialogTitle>
              <DialogDescription>
                Share an update with the whole school or a specific student audience.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
                <Input placeholder="Title" maxLength={MAX_ANNOUNCEMENT_TITLE_CHARACTERS} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
                <Textarea
                  className="min-h-[120px] resize-y"
                  placeholder="Write your announcement..."
                  maxLength={MAX_ANNOUNCEMENT_BODY_CHARACTERS}
                  value={form.body}
                  onChange={(event) => setForm({ ...form, body: event.target.value })}
                  required
                />
                <AnnouncementMediaInput
                  images={images}
                  embedUrls={embedUrls}
                  disabled={createPending}
                  onImagesChange={setImages}
                  onEmbedUrlsChange={setEmbedUrls}
                  onError={(title) => toast({ title, variant: 'destructive' })}
                />
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Audience</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button type="button" variant="tertiary" className="w-full justify-between" active={audienceMode === 'TARGETED'}>
                        {audienceMode === 'SCHOOL_WIDE'
                          ? 'School-wide'
                          : `${form.targetGrades.length + form.targetMajorPathways.length + form.targetMinorPathways.length} audience filters selected`}
                        <ChevronDown aria-hidden className="size-4 text-muted-foreground" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-[min(28rem,calc(100vw-2rem))] p-3">
                      <RadioGroup
                        value={audienceMode}
                        onValueChange={(value) => {
                          const nextMode = value as 'SCHOOL_WIDE' | 'TARGETED';
                          setAudienceMode(nextMode);
                          if (nextMode === 'SCHOOL_WIDE') {
                            updateTargeting({ targetGrades: [], targetMajorPathways: [], targetMinorPathways: [] });
                          }
                        }}
                        className="w-full gap-0.5"
                      >
                        <RadioItem index={0} value="SCHOOL_WIDE" label="School-wide" className="w-full" />
                        <RadioItem index={1} value="TARGETED" label="Target a specific audience" className="w-full" />
                      </RadioGroup>

                      {audienceMode === 'TARGETED' ? (
                        <div className="mt-3 grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
                          <FieldSet className="min-w-0 gap-0">
                            <FieldLegend variant="label">Grades</FieldLegend>
                            <CheckboxGroup
                              checkedIndices={new Set(GRADE_OPTIONS.flatMap((grade, index) => (form.targetGrades.includes(grade) ? [index] : [])))}
                              className="w-full"
                            >
                              {GRADE_OPTIONS.map((grade, index) => (
                                <CheckboxItem
                                  key={grade}
                                  index={index}
                                  label={`Grade ${grade}`}
                                  checked={form.targetGrades.includes(grade)}
                                  onToggle={() => {
                                    const next = form.targetGrades.includes(grade)
                                      ? form.targetGrades.filter((value) => value !== grade)
                                      : [...form.targetGrades, grade];
                                    updateTargeting({ targetGrades: next });
                                  }}
                                />
                              ))}
                            </CheckboxGroup>
                          </FieldSet>
                          <FieldSet className="min-w-0 gap-0">
                            <FieldLegend variant="label">Pathways</FieldLegend>
                            <CheckboxGroup
                              checkedIndices={new Set(PATHWAY_OPTIONS.flatMap((pathway, index) => (form.targetMajorPathways.includes(pathway.value) ? [index] : [])))}
                              className="w-full"
                            >
                              {PATHWAY_OPTIONS.map((pathway, index) => (
                                <CheckboxItem
                                  key={pathway.value}
                                  index={index}
                                  label={pathway.label}
                                  checked={form.targetMajorPathways.includes(pathway.value)}
                                  onToggle={() => {
                                    const next = form.targetMajorPathways.includes(pathway.value)
                                      ? form.targetMajorPathways.filter((value) => value !== pathway.value)
                                      : [...form.targetMajorPathways, pathway.value];
                                    updateTargeting({ targetMajorPathways: next });
                                  }}
                                />
                              ))}
                            </CheckboxGroup>
                          </FieldSet>
                        </div>
                      ) : null}
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Expires (optional)</label>
                  <DateTimePicker value={form.expiresAt} onChange={(expiresAt) => setForm({ ...form, expiresAt })} allowClear />
                </div>
                <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border pt-3">
                  <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input accent-accent-500"
                      checked={form.allowComments}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          allowComments: event.target.checked,
                        })
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
                          setForm({
                            ...form,
                            isAdminGeneral: event.target.checked,
                          })
                        }
                      />
                      Send push notifications
                    </label>
                  ) : null}
                  {hasRole(user, 'ADMIN', 'SUPER_ADMIN') ? (
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-input accent-accent-500"
                        checked={form.promoted}
                        onChange={(event) => setForm({ ...form, promoted: event.target.checked })}
                      />
                      Pin for one month
                    </label>
                  ) : null}
                </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="tertiary" disabled={createPending} onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
                <Button
                  type="submit"
                  loading={createPending}
                  disabled={audienceMode === 'TARGETED' && form.targetGrades.length === 0 && form.targetMajorPathways.length === 0 && form.targetMinorPathways.length === 0}
                >
                  Post announcement
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground">Loading…</div>
        ) : !data?.length ? (
          <Card className={`border-dashed py-16 text-center bg-surface-2 border-border/50 shadow-surface-1 ${CARD_SURFACE_FOREGROUND}`}>
            <CardContent className="pt-6">{showArchived ? 'No archived announcements' : 'No announcements yet'}</CardContent>
          </Card>
        ) : filtered.length === 0 ? (
          <Card className={`border-dashed py-16 text-center bg-surface-2 border-border/50 shadow-surface-1 ${CARD_SURFACE_FOREGROUND}`}>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">No announcements match your filters.</p>
              <Button variant="ghost" size="sm" className="mt-2" onClick={clearFilters}>
                Clear filters
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {hasActiveFilters ? (
              <p className="px-1 text-xs text-muted-foreground">
                {filtered.length} of {data.length} announcement
                {data.length === 1 ? '' : 's'}
              </p>
            ) : null}
            <CardGroup>
              {(filtered as any[]).map((announcement) => {
                const canArchiveAnnouncement = canArchiveAny || announcement.author?._id === user?._id;
                const announcementId = announcement._id as Id<'announcements'>;
                const isReviewPending = reviewPending?.id === announcement._id;
                const approving = isReviewPending && reviewPending?.action === 'approve';
                const rejecting = isReviewPending && reviewPending?.action === 'reject';
                return (
                  <AnnouncementCard
                    key={announcement._id}
                    announcement={announcement}
                    canArchive={canArchiveAnnouncement}
                    onArchive={(id: string) => {
                      void archiveAnnouncement({
                        announcementId: id as Id<'announcements'>,
                      })
                        .then(() => toast({ title: 'Archived' }))
                        .catch((error: unknown) =>
                          toast({
                            title: error instanceof Error ? error.message : 'Failed to archive',
                            variant: 'destructive',
                          }),
                        );
                    }}
                    onBookmarkToggle={(entry) => {
                      const toggle = entry.isBookmarked ? unbookmarkAnnouncement : bookmarkAnnouncement;
                      void toggle({
                        announcementId: entry._id as Id<'announcements'>,
                      }).catch(() => undefined);
                    }}
                    footer={
                      announcement.status === 'PENDING_APPROVAL' && canApproveAnnouncements ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-md bg-muted/40 p-2">
                          <span className="text-xs text-muted-foreground">Sponsor review required</span>
                          <Button
                            size="sm"
                            leadingIcon={Check}
                            loading={approving}
                            disabled={isReviewPending}
                            onClick={() => {
                              setReviewPending({
                                id: announcement._id,
                                action: 'approve',
                              });
                              void approveAnnouncement({ announcementId })
                                .then(() => toast({ title: 'Announcement published' }))
                                .catch((error: unknown) =>
                                  toast({
                                    title: error instanceof Error ? error.message : 'Failed to publish',
                                    variant: 'destructive',
                                  }),
                                )
                                .finally(() => setReviewPending(null));
                            }}
                          >
                            Publish
                          </Button>
                          <Button
                            size="sm"
                            variant="tertiary"
                            leadingIcon={X}
                            loading={rejecting}
                            disabled={isReviewPending}
                            onClick={() => {
                              setReviewPending({
                                id: announcement._id,
                                action: 'reject',
                              });
                              void rejectAnnouncement({ announcementId })
                                .then(() => toast({ title: 'Announcement sent back' }))
                                .catch((error: unknown) =>
                                  toast({
                                    title: error instanceof Error ? error.message : 'Failed to reject',
                                    variant: 'destructive',
                                  }),
                                )
                                .finally(() => setReviewPending(null));
                            }}
                          >
                            Send back
                          </Button>
                        </div>
                      ) : null
                    }
                  />
                );
              })}
            </CardGroup>
          </div>
        )}
      </div>
    </AppShell>
  );
}
