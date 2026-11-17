import { describe, expect, test } from 'vitest';
import { buildSlides } from './utils';
import type { WrappedSummary } from './types';

const empty: WrappedSummary = {
  userId: 'student', schoolYearStart: 2025, schoolYearLabel: '2025-26',
  rangeStart: '2025-08-01', rangeEnd: '2026-05-31', messagesSent: 0,
  channelsEngaged: 0, friends: 0, clubs: 0, flexCredits: 0, flexCreditsRequired: 8,
  pathwayFlexCredits: 0, topChannel: null, topMentioned: null,
  pathway: { major: null, minor: null, lanyardColor: null, label: null, peers: 0 },
  mostUsedWord: null, peakHour: null, longestStreak: 0, mostActiveDay: null,
  reactionsReceived: 0, topEmoji: null, longestMessageChars: 0,
};

describe('Wrapped participation story', () => {
  test('foregrounds recorded participation without requiring chat activity', () => {
    const slides = buildSlides({ ...empty, clubs: 2, friends: 3, flexCredits: 6,
      pathway: { ...empty.pathway, major: 'ENGINEERING', peers: 10 } }, 'Alex');
    expect(slides.map(({ key }) => key)).toEqual(['intro', 'friends', 'clubs', 'pathway', 'credits', 'outro']);
    expect(slides.find(({ key }) => key === 'credits')?.numericValue).toBe(6);
  });
  test('gives an honest complete story for a snapshot with no activity', () => {
    const slides = buildSlides(empty, 'Alex');
    expect(slides.map(({ key }) => key)).toEqual(['intro', 'unrecorded-year', 'outro']);
    expect(slides[1].caption).toContain('No activity is recorded');
    expect(slides.flatMap(({ numericValue }) => numericValue === undefined ? [] : [numericValue])).toEqual([]);
  });
  test('retains chat highlights and exact totals without inventing weekly activity', () => {
    const slides = buildSlides({ ...empty, messagesSent: 1, channelsEngaged: 1,
      topChannel: { channelId: 'channel', channelName: 'general', clubId: 'club', clubName: 'Robotics', messages: 1 } }, 'Alex');
    const messages = slides.find(({ key }) => key === 'messages');
    expect(messages?.numericValue).toBe(1);
    expect(messages?.caption).toBe('messages shared this school year.');
    expect(slides.some(({ key }) => key === 'top-channel')).toBe(true);
    expect(slides.some(({ key }) => key === 'top-mention')).toBe(false);
  });
});

test('optional daily series adds truthful dated stories', () => {
  expect(buildSlides(empty, 'Alex').some((slide) => slide.activity)).toBe(false);
  const slides = buildSlides({ ...empty, dailyActivity: [{ date: '2026-01-02', messages: 3 }], messagesSent: 3 }, 'Alex');
  expect(slides.find((slide) => slide.activity)?.activity?.days).toEqual([{ date: '2026-01-02', messages: 3 }]);
  expect(slides.find((slide) => slide.highlights)?.highlights).toEqual([{ date: '2026-01-02', label: 'First recorded message day' }]);
});

test('ISO snapshot boundaries become Eastern calendar dates', () => {
  const slides = buildSlides({ ...empty, rangeStart: '2025-08-01T04:00:00.000Z', rangeEnd: '2026-06-01T03:59:59.999Z', dailyActivity: [] }, 'Alex');
  expect(slides.find(slide => slide.activity)?.activity).toMatchObject({ start: '2025-08-01', end: '2026-05-31' });
});
