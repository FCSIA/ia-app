import { matchesSearchQuery } from '../../lib/search';

export type FeedFilters = {
  activeTag: string | null;
  selectedClubIds: string[];
  readFilter: 'all' | 'unread' | 'read';
  savedFilter: 'all' | 'saved';
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

export function compileAnnouncementFilters(
  filters: FeedFilters,
  search: string,
): (announcement: FilterableAnnouncement) => boolean {
  const { activeTag, readFilter, savedFilter } = filters;
  const clubIds = new Set(filters.selectedClubIds);
  const grades = new Set(filters.selectedGrades);
  const majorPathways = new Set(filters.selectedMajorPathways);
  const minorPathways = new Set(filters.selectedMinorPathways);
  const query = search.trim().toLowerCase();

  return (announcement) => {
    if (activeTag && announcement.targetType !== activeTag) return false;
    if (readFilter === 'unread' && announcement.isRead) return false;
    if (readFilter === 'read' && !announcement.isRead) return false;
    if (savedFilter === 'saved' && !announcement.isBookmarked) return false;
    if (clubIds.size > 0 && !clubIds.has(announcement.clubId ?? '')) return false;
    if (grades.size > 0 && !(announcement.targetGrade !== undefined && grades.has(announcement.targetGrade)) &&
      !announcement.targetGrades?.some((grade) => grades.has(grade))) return false;
    if (majorPathways.size > 0 && !(announcement.targetPathway !== undefined && majorPathways.has(announcement.targetPathway)) &&
      !announcement.targetMajorPathways?.some((pathway) => majorPathways.has(pathway))) return false;
    if (minorPathways.size > 0 && !announcement.targetMinorPathways?.some((pathway) => minorPathways.has(pathway))) return false;

    return matchesSearchQuery(query, [
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
  };
}
