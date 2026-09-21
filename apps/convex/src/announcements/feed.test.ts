/// <reference types="vite/client" />

import { convexTest } from 'convex-test';
import { describe, expect, it } from 'vitest';
import type { Doc } from '../_generated/dataModel';
import schema from '../schema';
import { listForUser } from './feed';

const modules = import.meta.glob('../**/*.*s');

async function fixture() {
  const t = convexTest(schema, modules);
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
        createdAt: index,
        updatedAt: index,
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
  filters: { unreadOnly?: boolean; bookmarkedOnly?: boolean } = {},
) {
  return t.run((ctx) => listForUser(ctx, { ...filters, paginationOpts: { cursor, numItems: 2 } }, user));
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
});
