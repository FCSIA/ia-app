import { matchesSearchQuery } from '../../lib/search';

export type FeedFilters = {
  activeTag: string | null;
  selectedClubIds: string[];
  readFilter: 'all' | 'unread' | 'read';
  savedFilter: 'all' | 'saved' | 'pinned';
  selectedGrades: number[];
  selectedMajorPathways: string[];
  selectedMinorPathways: string[];
};

type FilterableAnnouncement = {
  title: string;
  body: string;
  targetType: string;
  isRead: boolean;
  isBookmarked?: boolean;
  isPinned?: boolean;
  clubId?: string;
  targetGrade?: number;
  targetGrades?: number[];
  targetPathway?: string;
  targetMajorPathways?: string[];
  targetMinorPathways?: string[];
  author?: { firstName?: string | null; lastName?: string | null } | null;
  club?: { name: string } | null;
};

export function matchesAnnouncementFilters(
  announcement: FilterableAnnouncement,
  filters: FeedFilters,
  search: string,
): boolean {
  if (filters.activeTag && announcement.targetType !== filters.activeTag) return false;
  if (filters.readFilter === 'unread' && announcement.isRead) return false;
  if (filters.readFilter === 'read' && !announcement.isRead) return false;
  if (filters.savedFilter === 'saved' && !announcement.isBookmarked) return false;
  if (filters.savedFilter === 'pinned' && !announcement.isPinned) return false;
  if (filters.selectedClubIds.length > 0 && !filters.selectedClubIds.includes(announcement.clubId ?? '')) return false;
  if (filters.selectedGrades.length > 0 && !filters.selectedGrades.some((grade) =>
    announcement.targetGrade === grade || announcement.targetGrades?.includes(grade))) return false;
  if (filters.selectedMajorPathways.length > 0 && !filters.selectedMajorPathways.some((pathway) =>
    announcement.targetPathway === pathway || announcement.targetMajorPathways?.includes(pathway))) return false;
  if (filters.selectedMinorPathways.length > 0 && !filters.selectedMinorPathways.some((pathway) =>
    announcement.targetMinorPathways?.includes(pathway))) return false;

  return matchesSearchQuery(search.trim().toLowerCase(), [
    announcement.title,
    announcement.body,
    announcement.author?.firstName,
    announcement.author?.lastName,
    announcement.club?.name,
    announcement.targetType.replaceAll('_', ' '),
    announcement.targetGrade ? `Grade ${announcement.targetGrade}` : undefined,
    ...announcement.targetGrades?.map((grade) => `Grade ${grade}`) ?? [],
    announcement.targetPathway?.replaceAll('_', ' '),
    ...announcement.targetMajorPathways?.map((pathway) => pathway.replaceAll('_', ' ')) ?? [],
    ...announcement.targetMinorPathways?.map((pathway) => pathway.replaceAll('_', ' ')) ?? [],
  ]);
}
