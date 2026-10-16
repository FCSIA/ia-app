import { describe, expect, it } from 'vitest';
import { matchesAnnouncementFilters, type FeedFilters } from './announcement-feed-filters';

const filters: FeedFilters = {
  activeTag: null,
  selectedClubIds: [],
  readFilter: 'all',
  savedFilter: 'all',
  selectedGrades: [],
  selectedMajorPathways: [],
  selectedMinorPathways: [],
};
const announcement = {
  title: 'Fabrication session',
  body: 'Bring your project.',
  targetType: 'CLUB',
  clubId: 'robotics',
  club: { name: 'Robotics Club' },
  author: { firstName: 'Jane', lastName: 'Smith' },
  isRead: false,
  isBookmarked: true,
  isPinned: false,
  targetGrades: [10, 11],
  targetMajorPathways: ['INFORMATION_TECHNOLOGY'],
  targetMinorPathways: ['ENGINEERING'],
};

describe('announcement feed filters', () => {
  it('keeps audience, read, and saved constraints when filtering older records', () => {
    const selection: FeedFilters = { ...filters, selectedClubIds: ['robotics'], readFilter: 'unread', savedFilter: 'saved' };
    const olderRecords = [
      announcement,
      { ...announcement, isRead: true },
      { ...announcement, isBookmarked: false },
      { ...announcement, clubId: 'other' },
    ];
    expect(olderRecords.filter((record) => matchesAnnouncementFilters(record, selection, 'fabrication'))).toEqual([announcement]);
  });

  it('searches human-readable audience metadata along with content and authors', () => {
    for (const query of ['grade 10', 'information technology', 'engineering', 'Jane Smith', 'robotics']) {
      expect(matchesAnnouncementFilters(announcement, filters, query)).toBe(true);
    }
    expect(matchesAnnouncementFilters(announcement, filters, 'grade 12')).toBe(false);
  });

  it('composes grade and pathway dimensions without treating a major as a minor', () => {
    const selection = { ...filters, selectedGrades: [11], selectedMajorPathways: ['INFORMATION_TECHNOLOGY'], selectedMinorPathways: ['ENGINEERING'] };
    expect(matchesAnnouncementFilters(announcement, selection, '')).toBe(true);
    expect(matchesAnnouncementFilters(announcement, { ...selection, selectedMinorPathways: ['INFORMATION_TECHNOLOGY'] }, '')).toBe(false);
    expect(matchesAnnouncementFilters(announcement, { ...filters, savedFilter: 'pinned' }, '')).toBe(false);
  });
});
