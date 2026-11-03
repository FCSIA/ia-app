import { describe, expect, it } from 'vitest';
import {
  canSuggestFridayBrowse,
  commandWhen,
  mergeCommandEntities,
  personalCommandQueryArgs,
  rankCommandSuggestions,
  upcomingWorkshopMoments,
  type CommandSuggestion,
} from './command-suggestions';

const now = Date.parse('2026-10-27T12:00:00-04:00');
const hour = 3_600_000;
const candidate = (id: string, kind: CommandSuggestion['kind'], startAt = now + hour): CommandSuggestion => ({
  id, href: `/${id}`, kind, startAt, endAt: startAt + hour,
});

describe('personal command privacy', () => {
  it.each([
    { open: false, isAuthenticated: true, hasUser: true },
    { open: true, isAuthenticated: false, hasUser: true },
    { open: true, isAuthenticated: true, hasUser: false },
  ])('skips every personal query without an open authenticated user: %o', (state) => {
    expect(Object.values(personalCommandQueryArgs({ ...state, now }))).toEqual(['skip', 'skip', 'skip', 'skip']);
  });

  it('bounds the agenda while querying workshops from the current instant', () => {
    const args = personalCommandQueryArgs({ open: true, isAuthenticated: true, hasUser: true, now });
    expect(args.workshops).toEqual({ now, limit: 10 });
    expect(args.calendar).toMatchObject({ sources: ['PERSONAL', 'EXTERNAL'], endDate: now + 14 * 24 * hour });
    expect(args.events).toEqual({ from: now, to: now + 14 * 24 * hour, limit: 20 });
  });
});

describe('timely command ranking', () => {
  it('puts the nearest personal appointment ahead of a later workshop and unread items', () => {
    expect(rankCommandSuggestions([
      candidate('notice', 'unread'), candidate('workshop', 'workshop', now + 3 * hour),
      candidate('appointment', 'commitment'), candidate('review', 'task'),
    ], now)).toEqual(['appointment', 'workshop', 'review', 'notice']);
  });

  it('retains underway commitments and removes ended, expired, invalid and distant agenda items', () => {
    expect(rankCommandSuggestions([
      candidate('ended', 'event', now - 2 * hour),
      { ...candidate('finished', 'commitment', now - hour), endAt: now },
      candidate('underway', 'workshop', now - hour / 2),
      { ...candidate('expired', 'unread'), expiresAt: now },
      candidate('invalid', 'event', NaN),
      candidate('far-calendar', 'commitment', now + 30 * 24 * hour),
    ], now)).toEqual(['underway']);
  });

  it('keeps the nearest booked workshop even beyond the calendar lookahead', () => {
    expect(rankCommandSuggestions([candidate('next-booking', 'workshop', now + 35 * 24 * hour)], now)).toEqual(['next-booking']);
  });

  it('deduplicates canonical destinations and IDs without losing the useful timed item', () => {
    expect(rankCommandSuggestions([
      { ...candidate('notification', 'unread'), href: '/events/same' },
      { ...candidate('event', 'event'), href: '/events/same' },
      candidate('event', 'event'),
      candidate('other', 'commitment'),
    ], now)).toEqual(['other', 'event']);
  });

  it('caps review tasks and unread items so they do not crowd out the agenda', () => {
    const tasks = Array.from({ length: 5 }, (_, i) => candidate(`task-${i}`, 'task'));
    const unread = Array.from({ length: 6 }, (_, i) => candidate(`unread-${i}`, 'unread'));
    const result = rankCommandSuggestions([...tasks, ...unread, candidate('later-event', 'event', now + 3 * 24 * hour)], now);
    expect(result).toEqual(['task-0', 'task-1', 'unread-0', 'unread-1', 'unread-2', 'later-event']);
  });

  it('is deterministic for equal times regardless of input order and honors the total cap', () => {
    const items = [candidate('b', 'commitment'), candidate('a', 'commitment')];
    expect(rankCommandSuggestions(items, now, 1)).toEqual(['a']);
    expect(rankCommandSuggestions(items.toReversed(), now, 1)).toEqual(['a']);
    expect(rankCommandSuggestions(items, now, 0)).toEqual([]);
  });
});

describe('workshop sessions', () => {
  const morning = { _id: 'morning', startAt: now - 3 * hour, endAt: now - 2 * hour };
  const afternoon = { _id: 'afternoon', startAt: now + hour, endAt: now + 2 * hour };
  const workshop = {
    workshopId: 'robotics', sessions: [afternoon, morning], registered: true, assigned: false, teaching: false,
  };

  it('makes one workshop from duplicate rows/links, retains every linked session, and ranks its next session', () => {
    const moments = upcomingWorkshopMoments([workshop, { ...workshop, sessions: [afternoon] }], now);
    expect(moments).toHaveLength(1);
    expect(moments[0].sessions).toEqual([morning, afternoon]);
    expect(moments[0].startAt).toBe(afternoon.startAt);
  });

  it('allows assigned students and teachers, excluding unbooked or completed workshops', () => {
    const moments = upcomingWorkshopMoments([
      { ...workshop, workshopId: 'assigned', registered: false, assigned: true },
      { ...workshop, workshopId: 'hosted', registered: false, teaching: true },
      { ...workshop, workshopId: 'unbooked', registered: false },
      { ...workshop, workshopId: 'completed', sessions: [morning] },
    ], now);
    expect(moments.map((item) => item.workshopId)).toEqual(['assigned', 'hosted']);
  });
});

describe('unbooked Friday evidence', () => {
  const friday = { _id: 'friday', date: Date.parse('2026-10-30T12:00:00-04:00') };
  const empty = { student: true, hasMore: false, friday: null, items: [] };

  it('suggests browsing a near future Friday only with a complete student query', () => {
    expect(canSuggestFridayBrowse(friday, empty, now)).toBe(true);
    expect(canSuggestFridayBrowse(friday, undefined, now)).toBe(false);
    expect(canSuggestFridayBrowse(friday, { ...empty, student: false }, now)).toBe(false);
    expect(canSuggestFridayBrowse(friday, { ...empty, hasMore: true }, now)).toBe(false);
  });

  it('does not invent an empty booking when booked, assigned, same-day, distant, or a nearer Friday hides later bookings', () => {
    for (const item of [{ registered: true, assigned: false }, { registered: false, assigned: true }]) {
      expect(canSuggestFridayBrowse(friday, { ...empty, friday, items: [item] }, now)).toBe(false);
    }
    expect(canSuggestFridayBrowse(friday, empty, friday.date - hour)).toBe(false);
    expect(canSuggestFridayBrowse({ ...friday, date: now + 20 * 24 * hour }, empty, now)).toBe(false);
    expect(canSuggestFridayBrowse(friday, { ...empty, friday: { _id: 'nearer', date: now } }, now)).toBe(false);
  });
});

describe('source context', () => {
  it('formats school time across the DST boundary and honors 24-hour preferences', () => {
    const winter = Date.parse('2026-11-02T15:30:00Z');
    expect(commandWhen(winter, now)).toBe('Mon, Nov 2 · 10:30 AM');
    expect(commandWhen(winter, winter, true)).toBe('Today · 10:30');
  });

  it('merges upcoming published results with the search catalog using stable entity IDs', () => {
    expect(mergeCommandEntities([{ _id: 'near', title: 'near' }], [{ _id: 'near', title: 'updated' }, { _id: 'other', title: 'other' }]))
      .toEqual([{ _id: 'near', title: 'updated' }, { _id: 'other', title: 'other' }]);
  });
});
