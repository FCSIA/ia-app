import { describe, expect, it } from 'vitest';
import { compileAnnouncementFilters, type FeedFilters } from './announcement-feed-filters';

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
    expect(olderRecords.filter(compileAnnouncementFilters(selection, 'fabrication'))).toEqual([announcement]);
  });

  it('searches human-readable audience metadata along with content and authors', () => {
    for (const query of ['grade 10', 'information technology', 'engineering', 'Jane Smith', 'robotics']) {
      expect(compileAnnouncementFilters(filters, query)(announcement)).toBe(true);
    }
    expect(compileAnnouncementFilters(filters, 'grade 12')(announcement)).toBe(false);
  });

  it('composes grade and pathway dimensions without treating a major as a minor', () => {
    const selection = { ...filters, selectedGrades: [11], selectedMajorPathways: ['INFORMATION_TECHNOLOGY'], selectedMinorPathways: ['ENGINEERING'] };
    expect(compileAnnouncementFilters(selection, '')(announcement)).toBe(true);
    expect(compileAnnouncementFilters({ ...selection, selectedMinorPathways: ['INFORMATION_TECHNOLOGY'] }, '')(announcement)).toBe(false);
  });

  it('matches any selected value within a dimension, including legacy scalar targets', () => {
    const matches = compileAnnouncementFilters({
      ...filters,
      selectedGrades: [9, 11],
      selectedMajorPathways: ['BUSINESS', 'INFORMATION_TECHNOLOGY'],
    }, '');
    const legacy = {
      ...announcement,
      targetGrade: 11,
      targetGrades: undefined,
      targetPathway: 'INFORMATION_TECHNOLOGY',
      targetMajorPathways: undefined,
    };
    expect([announcement, legacy].filter(matches)).toEqual([announcement, legacy]);
    expect(matches({ ...legacy, targetGrade: undefined })).toBe(false);
    expect(matches({ ...legacy, targetPathway: undefined })).toBe(false);
    expect(matches({ ...legacy, targetGrade: 12 })).toBe(false);
  });

  it('keeps compiled selections stable while a new matcher reflects changed filters', () => {
    const selection = { ...filters, selectedGrades: [11] };
    const matches = compileAnnouncementFilters(selection, '  GRADE 10  ');
    selection.selectedGrades[0] = 12;
    expect(matches(announcement)).toBe(true);
    expect(compileAnnouncementFilters(selection, 'grade 10')(announcement)).toBe(false);
    expect(compileAnnouncementFilters({ ...filters, activeTag: 'SCHOOL_WIDE' }, '')(announcement)).toBe(false);
  });
});
