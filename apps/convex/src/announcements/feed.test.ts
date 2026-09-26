/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import type { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { listForUser, listPinnedForUser } from './feed';

const modules = import.meta.glob('../**/*.*s');

async function fixture() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const user = await t.run(async (ctx) => {
    const authorId = await ctx.db.insert('users', {
      uniqueId: 'TEACHER-1',
      firstName: 'Ada',
      lastName: 'Lovelace',
      roles: ['TEACHER'],
      isStudent: false,
      isTeacherStaff: true,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: 'ada lovelace',
      createdAt: 0,
      updatedAt: 0,
    });

    for (let index = 1; index <= 5; index += 1) {
      await ctx.db.insert('announcements', {
        authorId,
        title: `announcement-${index}`,
        body: 'A page boundary fixture.',
        targetType: 'SCHOOL_WIDE',
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        status: 'ACTIVE',
        allowComments: false,
        isAdminGeneral: false,
        commentCount: 0,
        createdAt: now + index,
        updatedAt: now + index,
      });
    }

    return (await ctx.db.get(authorId))!;
  });
  return { t, user };
}

async function page(
  t: ReturnType<typeof convexTest>,
  user: Doc<'users'>,
  cursor: string | null,
  filters: { archived?: boolean; unreadOnly?: boolean; bookmarkedOnly?: boolean; now?: number } = {},
) {
  return t.run((ctx) => listForUser(ctx, { ...filters, now: filters.now ?? Date.now(), paginationOpts: { cursor, numItems: 2 } }, user));
}

describe('announcement feed pagination', () => {
  it('continues a descending feed at exact page boundaries', async () => {
    const { t, user } = await fixture();
    const first = await page(t, user, null);
    const second = await page(t, user, first.continueCursor);
    const third = await page(t, user, second.continueCursor);

    expect(first.page.map((announcement) => announcement.title)).toEqual(['announcement-5', 'announcement-4']);
    expect(second.page.map((announcement) => announcement.title)).toEqual(['announcement-3', 'announcement-2']);
    expect(third.page.map((announcement) => announcement.title)).toEqual(['announcement-1']);
    expect(third.isDone).toBe(true);
  });

  it('keeps unread and saved filters when a page boundary is crossed', async () => {
    const { t, user } = await fixture();
    await t.run(async (ctx) => {
      const latest = await ctx.db.query('announcements').withIndex('by_createdAt').order('desc').first();
      const saved = await ctx.db.query('announcements').withIndex('by_createdAt').order('desc').take(2);
      await ctx.db.insert('announcementReads', {
        announcementId: latest!._id,
        userId: user._id,
        readAt: 5,
      });
      await ctx.db.insert('announcementBookmarks', {
        announcementId: saved[1]!._id,
        userId: user._id,
        createdAt: 5,
      });
    });

    const unreadFirst = await page(t, user, null, { unreadOnly: true });
    const unreadSecond = await page(t, user, unreadFirst.continueCursor, {
      unreadOnly: true,
    });
    const savedFirst = await page(t, user, null, { bookmarkedOnly: true });

    expect(unreadFirst.page.map((announcement) => announcement.title)).toEqual(['announcement-4']);
    expect(unreadSecond.page.map((announcement) => announcement.title)).toEqual(['announcement-3', 'announcement-2']);
    expect(savedFirst.page.map((announcement) => announcement.title)).toEqual(['announcement-4']);
  });

  it('serializes pins as personal state for the current user', async () => {
    const { t, user } = await fixture();
    await t.run(async (ctx) => {
      const announcement = await ctx.db.query('announcements').withIndex('by_createdAt').order('desc').first();
      await ctx.db.insert('announcementPins', {
        announcementId: announcement!._id,
        userId: user._id,
        createdAt: 5,
      });
    });

    const first = await page(t, user, null);

    expect(first.page[0]?.isPinned).toBe(true);
    expect(first.page[1]?.isPinned).toBe(false);
  });

  it('moves active announcements older than two weeks into the past feed', async () => {
    const { t, user } = await fixture();
    const oldAnnouncementId = await t.run((ctx) =>
      ctx.db.insert('announcements', {
        authorId: user._id,
        title: 'two-weeks-old',
        body: 'This belongs in Past Announcements.',
        targetType: 'SCHOOL_WIDE',
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        status: 'ACTIVE',
        allowComments: false,
        isAdminGeneral: false,
        commentCount: 0,
        createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
        updatedAt: Date.now(),
      }),
    );

    const active = await page(t, user, null);
    const past = await page(t, user, null, { archived: true });

    expect(active.page.some((announcement) => announcement._id === oldAnnouncementId)).toBe(false);
    expect(past.page.some((announcement) => announcement._id === oldAnnouncementId)).toBe(true);
  });

  it('moves an announcement across the age boundary as the client cutoff advances', async () => {
    const { t, user } = await fixture();
    const now = Date.now();
    const announcementId = await t.run((ctx) => ctx.db.insert('announcements', {
      authorId: user._id,
      title: 'age-boundary',
      body: 'Moves with the client supplied cutoff.',
      targetType: 'SCHOOL_WIDE',
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      status: 'ACTIVE',
      allowComments: false,
      isAdminGeneral: false,
      commentCount: 0,
      createdAt: now - 14 * 24 * 60 * 60 * 1000 + 1,
      updatedAt: now,
    }));
    await t.run((ctx) => ctx.db.insert('announcementPins', { announcementId, userId: user._id, createdAt: now }));
    const before = await t.run((ctx) => listForUser(ctx, { now, paginationOpts: { cursor: null, numItems: 20 } }, user));
    const after = await t.run((ctx) => listForUser(ctx, { archived: true, now: now + 2, paginationOpts: { cursor: null, numItems: 20 } }, user));
    const activePins = await t.run((ctx) => listPinnedForUser(ctx, user, now + 2));
    expect(before.page.some((item) => item._id === announcementId)).toBe(true);
    expect(after.page.some((item) => item._id === announcementId)).toBe(true);
    expect(activePins.some((item) => item._id === announcementId)).toBe(false);
  });

  it('finds a personal pin beyond the compatibility feed window', async () => {
    const { t, user } = await fixture();
    const now = Date.now();
    const targetId = await t.run(async (ctx) => {
      let oldestId = '' as Doc<'announcements'>['_id'];
      for (let index = 0; index < 520; index += 1) {
        const announcementId = await ctx.db.insert('announcements', {
          authorId: user._id,
          title: `deep-${index}`,
          body: 'Deep pinned result.',
          targetType: 'SCHOOL_WIDE',
          targetGrades: [],
          targetMajorPathways: [],
          targetMinorPathways: [],
          status: 'ACTIVE',
          allowComments: false,
          isAdminGeneral: false,
          commentCount: 0,
          createdAt: now + index,
          updatedAt: now + index,
        });
        if (index === 0) oldestId = announcementId;
      }
      await ctx.db.insert('announcementPins', { announcementId: oldestId, userId: user._id, createdAt: now });
      return oldestId;
    });
    const pins = await t.run((ctx) => listPinnedForUser(ctx, user, now));
    expect(pins.map((item) => item._id)).toContain(targetId);
  });

  it('does not reveal a pin when the current audience cannot view it', async () => {
    const { t, user } = await fixture();
    const outsider = await t.run(async (ctx) => {
      const outsiderId = await ctx.db.insert('users', {
        uniqueId: 'STUDENT-10',
        firstName: 'Grace',
        lastName: 'Hopper',
        roles: ['STUDENT'],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        gradeLevel: 10,
        dashboardLayout: [],
        searchText: 'grace hopper',
        createdAt: 0,
        updatedAt: 0,
      });
      const announcementId = await ctx.db.insert('announcements', {
        authorId: user._id,
        title: 'grade-nine-only',
        body: 'Should remain private to another grade.',
        targetType: 'GRADE',
        targetGrade: 9,
        targetGrades: [9],
        targetMajorPathways: [],
        targetMinorPathways: [],
        status: 'ACTIVE',
        allowComments: false,
        isAdminGeneral: false,
        commentCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
      await ctx.db.insert('announcementPins', { announcementId, userId: outsiderId, createdAt: Date.now() });
      return (await ctx.db.get(outsiderId))!;
    });
    const pins = await t.run((ctx) => listPinnedForUser(ctx, outsider, Date.now()));
    expect(pins).toEqual([]);
  });

  it('indexes recently archived statuses and active expirations into Past', async () => {
    const { t, user } = await fixture();
    const now = Date.now();
    const recentIds = await t.run(async (ctx) => {
      const archivedId = await ctx.db.insert('announcements', {
        authorId: user._id, title: 'recently-archived', body: 'Past by status.', targetType: 'SCHOOL_WIDE', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [], status: 'ARCHIVED', allowComments: false, isAdminGeneral: false, createdAt: now - 100, updatedAt: now,
      });
      const expiredId = await ctx.db.insert('announcements', {
        authorId: user._id, title: 'recently-expired', body: 'Past by expiresAt.', targetType: 'SCHOOL_WIDE', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [], status: 'ACTIVE', allowComments: false, isAdminGeneral: false, expiresAt: now - 1, createdAt: now - 100, updatedAt: now,
      });
      const archived = await ctx.db.query('announcements').withIndex('by_status_and_createdAt', (q) => q.eq('status', 'ARCHIVED').gt('createdAt', now - 14 * 24 * 60 * 60 * 1000)).collect();
      const expired = await ctx.db.query('announcements').withIndex('by_status_and_createdAt', (q) => q.eq('status', 'ACTIVE').gt('createdAt', now - 14 * 24 * 60 * 60 * 1000)).filter((q) => q.lte(q.field('expiresAt'), now)).collect();
      return { archivedIds: archived.map((item) => item._id), expiredIds: expired.map((item) => item._id), expected: [archivedId, expiredId] };
    });
    expect(recentIds.archivedIds).toContain(recentIds.expected[0]);
    expect(recentIds.expiredIds).toContain(recentIds.expected[1]);
  });
});

it('keeps compatible-feed results when newer records are filtered out', async () => {
  const { t, user } = await fixture();
  await t.run(async (ctx) => {
    const now = Date.now();
    for (let index = 6; index <= 55; index++) {
      await ctx.db.insert('announcements', {
        authorId: user._id,
        title: `archived-${index}`,
        body: 'Archived fixture',
        targetType: 'SCHOOL_WIDE',
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        status: 'ARCHIVED',
        allowComments: false,
        isAdminGeneral: false,
        commentCount: 0,
        createdAt: now + index,
        updatedAt: now + index,
      });
    }
  });
  const result = await t.run((ctx) =>
    listForUser(ctx, { now: Date.now(), paginationOpts: { cursor: null, numItems: 500 } }, user),
  );
  expect(result.page.map((item) => item.title)).toContain('announcement-5');
});
