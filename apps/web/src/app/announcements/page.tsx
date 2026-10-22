'use client';

import { useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { useAction, useMutation, usePaginatedQuery } from '@/lib/convex-react';
import { api } from '~/apps/convex/src/_generated/api';
import type { Id } from '~/apps/convex/src/_generated/dataModel';
import { hasRole, useCurrentUser } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Archive, Bookmark, Check, ChevronDown, ChevronUp, Inbox, Mail, Pin, Plus, SlidersHorizontal, X } from 'lucide-react';
import { CardGroup } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Tooltip } from '@/components/ui/tooltip';
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
import { DateTimePicker } from '@/components/ui/date-time-picker';
import { CheckboxGroup, CheckboxItem } from '@/components/ui/checkbox-group';
import { RadioGroup, RadioItem } from '@/components/ui/radio-group';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { FilterToggleIcon, FilterToggleItem } from '@/components/ui/filter-toggle-group';
import { AnnouncementCard } from '@/components/announcements/announcement-card';
import { compileAnnouncementFilters, type FeedFilters } from '@/components/announcements/announcement-feed-filters';
import { Label } from '@/components/ui/label';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AnnouncementFilterPanel } from '@/components/announcements/announcement-filter-panel';
import { AnnouncementMediaInput } from '@/components/announcements/announcement-media';
import { AnnouncementEditor } from '@/components/announcements/announcement-editor';
import { uploadFileToConvex } from '@/lib/convex-upload';
import { useAnnouncementFeedClock } from '@/components/announcements/use-announcement-feed-clock';

const PATHWAY_OPTIONS = [
  { value: 'INFORMATION_TECHNOLOGY', label: 'Information Technology' },
  { value: 'HEALTH_SCIENCE', label: 'Health Science' },
  { value: 'ENGINEERING', label: 'Engineering' },
];

const GRADE_OPTIONS = [9, 10, 11, 12];
const MAX_ANNOUNCEMENT_TITLE_CHARACTERS = 160;

type ClubFilterOption = {
  id: string;
  name: string;
};

const defaultFeedFilters: FeedFilters = {
  activeTag: null,
  selectedClubIds: [],
  readFilter: 'all',
  savedFilter: 'all',
  selectedGrades: [],
  selectedMajorPathways: [],
  selectedMinorPathways: [],
};

type FeedFiltersUpdate = Partial<FeedFilters> | 'reset' | ((state: FeedFilters) => Partial<FeedFilters>);

function feedFiltersReducer(state: FeedFilters, update: FeedFiltersUpdate): FeedFilters {
  if (update === 'reset') return defaultFeedFilters;
  const patch = typeof update === 'function' ? update(state) : update;
  return { ...state, ...patch };
}

const defaultAnnouncementForm = {
  title: '',
  body: '',
  bodyMarkdown: '',
  targetType: 'SCHOOL_WIDE',
  targetGrades: [] as number[],
  targetMajorPathways: [] as string[],
  targetMinorPathways: [] as string[],
  allowComments: false,
  isAdminGeneral: false,
  promoted: false,
  expiresAt: '',
};

type ComposerState = {
  showNew: boolean;
  audienceMode: 'SCHOOL_WIDE' | 'TARGETED';
  images: File[];
  embedUrls: string[];
  form: typeof defaultAnnouncementForm;
  createPending: boolean;
};

const defaultComposerState: ComposerState = {
  showNew: false,
  audienceMode: 'SCHOOL_WIDE',
  images: [],
  embedUrls: [],
  form: defaultAnnouncementForm,
  createPending: false,
};

function composerReducer(state: ComposerState, patch: Partial<ComposerState>): ComposerState {
  return { ...state, ...patch };
}

export default function AnnouncementsPage() {
  const user = useCurrentUser();
  const { toast } = useToast();
  const [pastOpen, setPastOpen] = useState(false);
  const feedNow = useAnnouncementFeedClock(3_600_000);
  const [composer, dispatchComposer] = useReducer(composerReducer, defaultComposerState);
  const { showNew, audienceMode, images, embedUrls, form, createPending } = composer;
  const setShowNew = (showNew: boolean) => dispatchComposer({ showNew });
  const setAudienceMode = (audienceMode: ComposerState['audienceMode']) => dispatchComposer({ audienceMode });
  const setImages = (images: File[]) => dispatchComposer({ images });
  const setEmbedUrls = (embedUrls: string[]) => dispatchComposer({ embedUrls });
  const setForm = (form: ComposerState['form']) => dispatchComposer({ form });
  const setCreatePending = (createPending: boolean) => dispatchComposer({ createPending });
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [filters, dispatchFilters] = useReducer(feedFiltersReducer, defaultFeedFilters);
  const {
    activeTag, selectedClubIds, readFilter, savedFilter, selectedGrades,
    selectedMajorPathways, selectedMinorPathways,
  } = filters;
  const [filtersOpen, setFiltersOpen] = useState(false);

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
  const canPin = !!user;
  const canArchiveAny = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN');
  const canApproveAnnouncements = !!user && hasRole(user, 'ADMIN', 'SUPER_ADMIN', 'TEACHER');

  const { results: data, status: feedStatus, loadMore: loadMoreAnnouncements } = usePaginatedQuery(api.announcements.feed.listPage, { archived: false, bookmarkedOnly: savedFilter === 'saved' || undefined, unreadOnly: readFilter === 'unread' || undefined, now: feedNow }, { initialNumItems: 30 });
  const { results: pinnedData, status: pinnedStatus, loadMore: loadMorePins } = usePaginatedQuery(
    api.announcements.feed.listPinnedPage,
    {
      now: feedNow,
      bookmarkedOnly: savedFilter === 'saved' || undefined,
      readOnly: readFilter === 'read' || undefined,
      unreadOnly: readFilter === 'unread' || undefined,
    },
    { initialNumItems: 30 },
  );
  const dataWithPins = useMemo(() => {
    const feedIds = new Set(data.map((announcement) => announcement._id));
    return [...pinnedData.filter((announcement) => !feedIds.has(announcement._id)), ...data];
  }, [data, pinnedData]);
  const {
    results: pastAnnouncements,
    status: pastFeedStatus,
    loadMore: loadMorePastAnnouncements,
  } = usePaginatedQuery(
    api.announcements.feed.listPage,
    pastOpen ? { archived: true, now: feedNow } : 'skip',
    { initialNumItems: 20 },
  );
  const { results: recentExpired, status: expiredStatus, loadMore: loadMoreExpired } = usePaginatedQuery(
    api.announcements.feed.listPastStatusPage,
    pastOpen ? { status: 'EXPIRED', now: feedNow } : 'skip',
    { initialNumItems: 20 },
  );
  const { results: recentArchived, status: archivedStatus, loadMore: loadMoreArchived } = usePaginatedQuery(
    api.announcements.feed.listPastStatusPage,
    pastOpen ? { status: 'ARCHIVED', now: feedNow } : 'skip',
    { initialNumItems: 20 },
  );
  const { results: recentRejected, status: rejectedStatus, loadMore: loadMoreRejected } = usePaginatedQuery(
    api.announcements.feed.listPastStatusPage,
    pastOpen ? { status: 'REJECTED', now: feedNow } : 'skip',
    { initialNumItems: 20 },
  );
  const { results: recentlyExpired, status: recentlyExpiredStatus, loadMore: loadMoreRecentlyExpired } = usePaginatedQuery(
    api.announcements.feed.listPastStatusPage,
    pastOpen ? { status: 'ACTIVE', now: feedNow } : 'skip',
    { initialNumItems: 20 },
  );
  const pastStatusPages = [
    { status: recentlyExpiredStatus, loadMore: loadMoreRecentlyExpired },
    { status: expiredStatus, loadMore: loadMoreExpired },
    { status: archivedStatus, loadMore: loadMoreArchived },
    { status: rejectedStatus, loadMore: loadMoreRejected },
  ];
  const pastAllAnnouncements = useMemo(() => {
    const byId = new Map<string, any>();
    for (const item of [...pastAnnouncements, ...recentExpired, ...recentArchived, ...recentRejected, ...recentlyExpired]) byId.set(item._id, item);
    return [...byId.values()].sort((left, right) => right.createdAt - left.createdAt);
  }, [pastAnnouncements, recentExpired, recentArchived, recentRejected, recentlyExpired]);
  const isLoading = feedStatus === 'LoadingFirstPage' || pinnedStatus === 'LoadingFirstPage';
  const canLoadMore = feedStatus === 'CanLoadMore' || feedStatus === 'LoadingMore';
  const canLoadMorePast = pastFeedStatus === 'CanLoadMore' || pastFeedStatus === 'LoadingMore' || pastStatusPages.some(({ status }) => status === 'CanLoadMore' || status === 'LoadingMore');
  const canLoadPastNow = pastFeedStatus === 'CanLoadMore' || pastStatusPages.some(({ status }) => status === 'CanLoadMore');
  const isLoadingMorePast = pastFeedStatus === 'LoadingMore' || pastStatusPages.some(({ status }) => status === 'LoadingMore');

  const createAnnouncement = useMutation(api.announcements.feed.create);
  const generateUploadUrl = useMutation(api.uploads.files.generateUploadUrl);
  const finalizeAnnouncementImage = useAction(api.uploads.files.finalizeAnnouncementImage);
  const archiveAnnouncement = useMutation(api.announcements.engagement.archive);
  const pinAnnouncement = useMutation(api.announcements.engagement.pin);
  const unpinAnnouncement = useMutation(api.announcements.engagement.unpin);
  const bookmarkAnnouncement = useMutation(api.announcements.engagement.bookmark);
  const unbookmarkAnnouncement = useMutation(api.announcements.engagement.unbookmark);
  const approveAnnouncement = useMutation(api.announcements.feed.approve);
  const rejectAnnouncement = useMutation(api.announcements.feed.reject);

  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    [...dataWithPins, ...pastAllAnnouncements].forEach((announcement: any) => tags.add(announcement.targetType));
    return ['SCHOOL_WIDE', 'GRADE', 'PATHWAY', 'CLUB', 'INTERSECTION'].filter((tag) => tags.has(tag));
  }, [dataWithPins, pastAllAnnouncements]);

  const availableClubs = useMemo<ClubFilterOption[]>(() => {
    const clubsById = new Map<string, ClubFilterOption>();

    [...dataWithPins, ...pastAllAnnouncements].forEach((announcement: any) => {
      if (announcement.club?._id && announcement.club?.name) {
        clubsById.set(announcement.club._id, {
          id: announcement.club._id,
          name: announcement.club.name,
        });
      }
    });

    return Array.from(clubsById.values()).sort((left, right) => left.name.localeCompare(right.name));
  }, [dataWithPins, pastAllAnnouncements]);

  const matchesFilters = useMemo(() => compileAnnouncementFilters(filters, deferredSearch), [filters, deferredSearch]);
  const filtered = useMemo(() => {
    if (!dataWithPins) return [];

    return dataWithPins.filter(matchesFilters).sort((left: any, right: any) => {
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      if (left.isPromoted !== right.isPromoted) return left.isPromoted ? -1 : 1;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }, [dataWithPins, matchesFilters]);

  // These groups explain the ordering the feed already uses. Read state never
  // changes a post's position in All; only the explicit Unread filter removes it.
  const feedSections = useMemo(() => [
    { id: 'personal-pins' as const, label: 'Pinned for you', items: filtered.filter((entry) => entry.isPinned) },
    { id: 'important' as const, label: 'Important', items: filtered.filter((entry) => !entry.isPinned && entry.isPromoted) },
    { id: 'latest' as const, label: 'Latest', items: filtered.filter((entry) => !entry.isPinned && !entry.isPromoted) },
  ].filter((section) => section.items.length > 0), [filtered]);
  const pendingPinFocus = useRef<{ id: string; pinned: boolean } | null>(null);
  useEffect(() => {
    const pending = pendingPinFocus.current;
    if (!pending || !filtered.some((entry) => entry._id === pending.id && !!entry.isPinned === pending.pinned)) return;
    // Pinning moves the record to another section and remounts its card. Keep
    // keyboard users with the record instead of returning focus to the body.
    document.getElementById(`announcement-more-${pending.id}`)?.focus();
    pendingPinFocus.current = null;
  }, [filtered]);

  const filteredPastAnnouncements = useMemo(() =>
    pastAllAnnouncements.filter(matchesFilters),
  [matchesFilters, pastAllAnnouncements]);

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
        bodyMarkdown: form.bodyMarkdown.trim() || undefined,
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
      setForm(defaultAnnouncementForm);
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
    dispatchFilters('reset');
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
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex flex-col gap-3">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-3 lg:grid-cols-[auto_minmax(10rem,1fr)_auto_auto]">
            <ToggleGroup
              type="single"
              aria-label="Announcement feed"
              orientation="horizontal"
              variant="outline"
              size="sm"
              className="col-start-1 row-start-2 justify-start gap-1 lg:row-start-1"
              value={
                readFilter === 'unread' && savedFilter === 'all'
                  ? 'unread'
                  : readFilter === 'all'
                    ? savedFilter
                    : ''
              }
              onValueChange={(value) => {
                if (!value) return;
                dispatchFilters({
                  readFilter: value === 'unread' ? 'unread' : 'all',
                  savedFilter: value === 'saved' ? 'saved' : 'all',
                });
              }}
            >
              <FilterToggleItem value="all">
                <FilterToggleIcon>
                  <Inbox
                    aria-hidden
                    className={readFilter === 'all' && savedFilter === 'all' ? 'text-primary' : undefined}
                  />
                </FilterToggleIcon>
                All
              </FilterToggleItem>
              <FilterToggleItem value="unread">
                <FilterToggleIcon>
                  <Mail aria-hidden className={readFilter === 'unread' ? 'text-primary' : undefined} />
                </FilterToggleIcon>
                Unread
              </FilterToggleItem>
              <FilterToggleItem value="saved">
                <FilterToggleIcon>
                  <Bookmark
                    aria-hidden
                    fill={savedFilter === 'saved' ? 'currentColor' : 'none'}
                    className={savedFilter === 'saved' ? 'text-primary' : undefined}
                  />
                </FilterToggleIcon>
                Saved
              </FilterToggleItem>
            </ToggleGroup>
            <SearchInput
              value={search}
              onValueChange={setSearch}
              placeholder="Search announcements"
              size="sm"
              className="col-start-1 row-start-1 min-w-0 lg:col-start-2"
              inputClassName="bg-background"
            />
            <div className="col-start-2 row-start-1 lg:col-start-3">
              <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
                <PopoverTrigger asChild>
                  <Button variant="secondary" leadingIcon={SlidersHorizontal} active={filtersOpen}>
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
                  className="w-[min(24rem,calc(100vw-2rem))] px-2 py-3"
                  aria-labelledby="announcement-filters-title"
                >
                  <div className="mb-3 flex items-center justify-between gap-3 px-4">
                    <h3 id="announcement-filters-title" className="text-sm font-medium text-foreground">
                      Filters
                    </h3>
                    {activeFilterCount > 0 ? (
                      <Button variant="ghost" size="sm" onClick={resetFacetFilters}>
                        Reset
                      </Button>
                    ) : null}
                  </div>
                  <ScrollArea
                    className="max-h-[min(36rem,calc(var(--radix-popover-content-available-height)-5rem))]"
                    viewportClassName="max-h-[min(36rem,calc(var(--radix-popover-content-available-height)-5rem))]"
                  >
                    <div className="p-1">
                      <AnnouncementFilterPanel
                        filters={filters}
                        onFiltersChange={dispatchFilters}
                        availableTags={availableTags}
                        availableClubs={availableClubs}
                        gradeOptions={GRADE_OPTIONS}
                        pathwayOptions={PATHWAY_OPTIONS}
                      />
                    </div>
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            {canPost ? (
              <Tooltip content="New announcement">
                <Button
                  className="col-start-2 row-start-2 justify-self-end lg:col-start-4 lg:row-start-1"
                  size="icon-sm"
                  onClick={() => setShowNew(true)}
                  aria-label="New announcement"
                >
                  <Plus />
                </Button>
              </Tooltip>
            ) : null}
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
                <AnnouncementEditor
                  value={form.bodyMarkdown || form.body}
                  disabled={createPending}
                  onChange={(body, bodyMarkdown) => setForm({ ...form, body, bodyMarkdown })}
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
                  {audienceMode === 'TARGETED' && form.targetGrades.length === 0 && form.targetMajorPathways.length === 0 && form.targetMinorPathways.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Choose at least one grade or pathway.</p>
                  ) : null}
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
                      Mark important for one month
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
        ) : !hasActiveFilters && dataWithPins.length === 0 && feedStatus === 'Exhausted' && pinnedStatus === 'Exhausted' ? (
          <Empty size="inline" frame="panel">
            <EmptyHeader><EmptyTitle>No announcements yet</EmptyTitle></EmptyHeader>
          </Empty>
        ) : filtered.length === 0 ? (
          <Empty size="inline" frame="panel">
            <EmptyHeader><EmptyTitle>No announcements match your filters.</EmptyTitle></EmptyHeader>
            {canLoadMore || pinnedStatus === 'CanLoadMore' ? <EmptyContent>
                {canLoadMore ? <Button variant="tertiary" size="sm" className="mt-2" disabled={feedStatus !== 'CanLoadMore'} onClick={() => loadMoreAnnouncements(30)}>{feedStatus === 'LoadingMore' ? 'Loading...' : 'Load more'}</Button> : null}
                {pinnedStatus === 'CanLoadMore' ? <Button variant="tertiary" size="sm" className="mt-2" onClick={() => loadMorePins(30)}>Load more pinned announcements</Button> : null}
            </EmptyContent> : null}
          </Empty>
        ) : (
          <div className="flex flex-col gap-6">
            {pinnedStatus === 'CanLoadMore' || pinnedStatus === 'LoadingMore' ? (
              <div className="flex justify-center">
                <Button variant="tertiary" disabled={pinnedStatus !== 'CanLoadMore'} onClick={() => loadMorePins(30)}>
                  {pinnedStatus === 'LoadingMore' ? 'Loading pinned…' : 'Load more pinned announcements'}
                </Button>
              </div>
            ) : null}
            {hasActiveFilters && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">
                  {filtered.length} matching announcement{filtered.length === 1 ? '' : 's'} in the loaded feed
                </p>
                <Button variant="ghost" size="sm" onClick={clearFilters}>Clear filters</Button>
              </div>
            )}
            {feedSections.map((section) => (
              <section key={section.id} aria-labelledby={`announcements-${section.id}`} className="flex flex-col gap-3">
                <h2 id={`announcements-${section.id}`} className="flex items-center gap-2 text-sm font-medium text-foreground">
                  {section.id === 'personal-pins' ? <Pin aria-hidden="true" className="size-3.5" fill="currentColor" strokeWidth={1.5} /> : null}
                  {section.label}
                </h2>
                <CardGroup separated corners="compact" border="outlined" aria-label={`${section.label} announcements`}>
                  {(section.items as any[]).map((announcement) => {
                    const canArchiveAnnouncement = canArchiveAny || announcement.author?._id === user?._id;
                    const announcementId = announcement._id as Id<'announcements'>;
                    const isReviewPending = reviewPending?.id === announcement._id;
                    const approving = isReviewPending && reviewPending?.action === 'approve';
                    const rejecting = isReviewPending && reviewPending?.action === 'reject';
                    return (
                      <AnnouncementCard
                        key={announcement._id}
                        announcement={announcement}
                        orderingContext={section.id}
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
                          }).catch(() => toast({ title: 'Could not update saved announcement', variant: 'destructive' }));
                        }}
                        onPinToggle={canPin ? (entry) => {
                          pendingPinFocus.current = { id: entry._id, pinned: !entry.isPinned };
                          const toggle = entry.isPinned ? unpinAnnouncement : pinAnnouncement;
                          void toggle({
                            announcementId: entry._id as Id<'announcements'>,
                          })
                            .then(() => toast({ title: entry.isPinned ? 'Announcement unpinned' : 'Announcement pinned' }))
                            .catch((error: unknown) => {
                              pendingPinFocus.current = null;
                              toast({
                                title: error instanceof Error ? error.message : 'Could not update pin',
                                variant: 'destructive',
                              });
                            });
                        } : undefined}
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
              </section>
            ))}
            {canLoadMore ? <div className="flex justify-center"><Button variant="tertiary" disabled={feedStatus !== 'CanLoadMore'} onClick={() => loadMoreAnnouncements(30)}>{feedStatus === 'LoadingMore' ? 'Loading...' : 'Load more'}</Button></div> : null}
          </div>
        )}

        <Collapsible open={pastOpen} onOpenChange={setPastOpen} className="mt-8">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" leadingIcon={Archive} trailingIcon={pastOpen ? ChevronUp : ChevronDown} active={pastOpen}>
              Past announcements
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4">
            {pastFeedStatus === 'LoadingFirstPage' || expiredStatus === 'LoadingFirstPage' || archivedStatus === 'LoadingFirstPage' || rejectedStatus === 'LoadingFirstPage' || recentlyExpiredStatus === 'LoadingFirstPage' ? (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading past announcements…</p>
            ) : filteredPastAnnouncements.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
                {hasActiveFilters ? 'No past announcements match your filters.' : 'No past announcements.'}
                {canLoadMorePast ? (
                  <div className="mt-3 flex justify-center"><Button variant="tertiary" disabled={!canLoadPastNow || isLoadingMorePast} onClick={() => {
                    if (pastFeedStatus === 'CanLoadMore') loadMorePastAnnouncements(20);
                    for (const stream of pastStatusPages) if (stream.status === 'CanLoadMore') stream.loadMore(20);
                  }}>Load more past announcements</Button></div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-4">
                <CardGroup separated corners="compact" border="outlined" aria-label="Past announcements">
                  {filteredPastAnnouncements.map((announcement: any) => (
                    <AnnouncementCard
                      key={announcement._id}
                      announcement={announcement}
                      onBookmarkToggle={(entry) => {
                        const toggle = entry.isBookmarked ? unbookmarkAnnouncement : bookmarkAnnouncement;
                        void toggle({
                          announcementId: entry._id as Id<'announcements'>,
                        }).catch(() => toast({ title: 'Could not update saved announcement', variant: 'destructive' }));
                      }}
                    />
                  ))}
                </CardGroup>
                {canLoadMorePast ? (
                  <div className="flex justify-center">
                    <Button
                      variant="tertiary"
                      disabled={!canLoadPastNow || isLoadingMorePast}
                      onClick={() => {
                        if (pastFeedStatus === 'CanLoadMore') loadMorePastAnnouncements(20);
                        for (const stream of pastStatusPages) if (stream.status === 'CanLoadMore') stream.loadMore(20);
                      }}
                    >
                      {isLoadingMorePast ? 'Loading...' : 'Load more past announcements'}
                    </Button>
                  </div>
                ) : null}
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </AppShell>
  );
}
