/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { ConvexError } from 'convex/values';
import { describe, expect, it, vi } from 'vitest';
import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import schema from '../schema';

vi.mock('../../lib/currentUser', async (original) => ({
  ...(await original<typeof import('../../lib/currentUser')>()),
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<'users'>) : null;
  },
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<'users'>) : null;
    if (!user) throw new ConvexError('Unauthenticated');
    return user;
  },
}));
const modules = import.meta.glob('/src/**/*.*s');

async function fixture() {
  const t = convexTest(schema, modules);
  const now = Date.now();
  const ids = await t.run(async (ctx) => {
    const user = (uniqueId: string, roles: ('STUDENT' | 'TEACHER')[]) => ctx.db.insert('users', {
      uniqueId, firstName: uniqueId, lastName: 'Preview', roles,
      isStudent: roles.includes('STUDENT'), isTeacherStaff: roles.includes('TEACHER'), isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId, createdAt: now, updatedAt: now,
    });
    const student = await user('student', ['STUDENT']);
    const teacher = await user('teacher', ['TEACHER']);
    const other = await user('other', ['STUDENT']);
    const club = await ctx.db.insert('clubs', { name: 'Robotics', joinPolicy: 'OPEN', isActive: true, memberCount: 1, channelCount: 0, createdAt: now, updatedAt: now });
    await ctx.db.insert('clubSponsors', { clubId: club, userId: teacher, addedAt: now });
    await ctx.db.insert('clubMembers', { clubId: club, userId: teacher, role: 'LEADER', joinedAt: now });
    return { student, teacher, other, club };
  });
  return { t, now, ...ids };
}

describe('dashboard previews', () => {
  it('counts unread published news while excluding read, expired, draft, and inaccessible posts', async () => {
    const { t, now, student, teacher, club } = await fixture();
    const pinned = await t.run(async (ctx) => {
      const post = (title: string, extra = {}) => ctx.db.insert('announcements', {
        authorId: teacher, title, body: 'Announcement', targetType: 'SCHOOL_WIDE', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [],
        status: 'ACTIVE', allowComments: false, isAdminGeneral: false, commentCount: 0, createdAt: now - 100, updatedAt: now, ...extra,
      });
      const pinned = await post('Pinned');
      await post('Unread');
      const read = await post('Read');
      await ctx.db.insert('announcementReads', { announcementId: read, userId: student, readAt: now });
      await post('Expired', { expiresAt: now - 1 });
      await post('Own rejected', { authorId: student, status: 'REJECTED' });
      await post('Club only', { targetType: 'CLUB', clubId: club });
      await ctx.db.insert('announcementPins', { announcementId: pinned, userId: student, createdAt: now });
      return pinned;
    });
    const result = await t.withIdentity({ subject: student }).query(api.announcements.feed.unreadPreview, { limit: 1, now });
    expect(result.total).toBe(2);
    expect(result.items.map((item) => item._id)).toEqual([pinned]);
    expect(result.hasMore).toBe(false);
  });

  it('shows a sponsor pending club approval without exposing it to another student', async () => {
    const { t, now, student, teacher, other, club } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert('announcements', { authorId: student, clubId: club, title: 'Review robotics trip', body: 'Draft', targetType: 'CLUB', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [], status: 'PENDING_APPROVAL', allowComments: false, isAdminGeneral: false, createdAt: now, updatedAt: now });
      await ctx.db.insert('announcements', { authorId: student, title: 'Needs changes', body: 'Draft', targetType: 'SCHOOL_WIDE', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [], status: 'REJECTED', allowComments: false, isAdminGeneral: false, createdAt: now, updatedAt: now });
    });
    const sponsor = await t.withIdentity({ subject: teacher }).query(api.dashboard.needsYou.list, {});
    expect(sponsor.items.map((item) => item.title)).toEqual(['Review robotics trip']);
    expect(sponsor.total).toBe(1);
    const author = await t.withIdentity({ subject: student }).query(api.dashboard.needsYou.list, {});
    expect(author.items.map((item) => item.kind)).toEqual(['changes']);
    const stranger = await t.withIdentity({ subject: other }).query(api.dashboard.needsYou.list, {});
    expect(stranger.total).toBe(0);
  });

  it('returns one sponsored club with the stronger role for a sponsor who is also a member', async () => {
    const { t, teacher, club } = await fixture();
    const result = await t.withIdentity({ subject: teacher }).query(api.clubs.management.getMyClubs, {});
    expect(result.clubs).toHaveLength(1);
    expect(result.clubs[0]?._id).toBe(club);
    expect(result.clubs[0]?.role).toBe('SPONSOR');
  });

  it('counts unread accessible channels only for the requested dashboard activity preview', async () => {
    const { t, now, student, teacher, club } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.insert('clubMembers', { clubId: club, userId: student, role: 'MEMBER', joinedAt: now });
      for (const [name, visibility, read] of [['News', 'PUBLIC', false], ['Private', 'PRIVATE', false], ['Read', 'PUBLIC', true]] as const) {
        const channelId = await ctx.db.insert('clubChannels', { clubId: club, name, visibility, createdById: teacher, createdAt: now, updatedAt: now });
        await ctx.db.insert('clubChannelMessages', { channelId, authorId: teacher, body: name, isPinned: false, createdAt: now, updatedAt: now });
        if (read) await ctx.db.insert('clubChannelReadReceipts', { clubId: club, channelId, userId: student, lastReadAt: now });
      }
    });
    const client = t.withIdentity({ subject: student });
    expect((await client.query(api.clubs.management.getMyClubs, {})).clubs[0]).not.toHaveProperty('unreadChannels');
    const preview = await client.query(api.clubs.management.getMyClubs, { includeActivity: true });
    expect(preview.clubs[0]?.unreadChannels).toBe(1);
    expect(preview.clubs[0]?.unreadHasMore).toBe(false);
  });

  it('selects the next Friday and only the viewer’s registration or hosted workshop', async () => {
    const { t, now, student, teacher, other } = await fixture();
    await t.run(async (ctx) => {
      for (const offset of [-7, 1, 8]) {
        const friday = await ctx.db.insert('flexFridays', { date: now + offset * 86_400_000, type: 'ALL_STUDENT', isSchoolDay: true, createdAt: now });
        const session = await ctx.db.insert('flexSessions', { flexFridayId: friday, title: 'Session', startTime: '09:00', endTime: '10:00', sessionType: 'STUDENT_CHOICE', createdAt: now, updatedAt: now });
        const workshop = await ctx.db.insert('flexWorkshops', { teacherId: teacher, title: `Workshop ${offset}`, location: 'Room 204', targetGrades: [], targetMajorPathways: [], targetMinorPathways: [], createdAt: now, updatedAt: now });
        await ctx.db.insert('flexWorkshopSessions', { workshopId: workshop, sessionId: session, createdAt: now });
        await ctx.db.insert('flexRegistrations', { workshopId: workshop, studentId: student, createdAt: now });
      }
    });
    const result = await t.withIdentity({ subject: student }).query(api.dashboard.flexFriday.snapshot, { from: now });
    expect(result?.workshops.map((row) => row.title)).toEqual(['Workshop 1']);
    const staff = await t.withIdentity({ subject: teacher }).query(api.dashboard.flexFriday.snapshot, { from: now });
    expect(staff?.workshops[0]?.registered).toBe(1);
    const stranger = await t.withIdentity({ subject: other }).query(api.dashboard.flexFriday.snapshot, { from: now });
    expect(stranger?.workshops).toEqual([]);
  });
});
