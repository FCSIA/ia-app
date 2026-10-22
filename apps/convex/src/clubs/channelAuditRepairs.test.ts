/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import rateLimiter from '@convex-dev/rate-limiter/test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { api } from '../_generated/api';
import schema from '../schema';
import type { QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { NO_CLUB_PERMISSIONS } from './rolePermissions';
afterEach(() => vi.useRealTimers());
vi.mock('../../lib/currentUser', () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<'users'>) : null;
  },
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error('Unauthenticated');
    return ctx.db.get(identity.subject as Id<'users'>);
  },
}));

const modules = import.meta.glob('/src/**/*.*s');

async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const makeUser = (uniqueId: string) =>
      ctx.db.insert('users', {
        uniqueId,
        firstName: uniqueId,
        lastName: 'Test',
        roles: ['STUDENT'],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: uniqueId,
        createdAt: 1,
        updatedAt: 1,
      });
    const memberId = await makeUser('UNREAD-MEMBER');
    const otherId = await makeUser('UNREAD-OTHER');
    const outsiderId = await makeUser('UNREAD-OUTSIDER');
    const clubId = await ctx.db.insert('clubs', {
      name: 'Unread Club',
      joinPolicy: 'OPEN',
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    for (const userId of [memberId, otherId]) {
      await ctx.db.insert('clubMembers', {
        clubId,
        userId,
        role: 'MEMBER',
        joinedAt: 1,
      });
    }
    const channelId = await ctx.db.insert('clubChannels', {
      clubId,
      name: 'General',
      visibility: 'PUBLIC',
      createdById: memberId,
      createdAt: 1,
      updatedAt: 1,
    });
    const privateChannelId = await ctx.db.insert('clubChannels', {
      clubId,
      name: 'Private',
      visibility: 'PRIVATE',
      createdById: memberId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert('clubChannelReadReceipts', {
      clubId,
      channelId,
      userId: memberId,
      lastReadAt: 10,
    });
    await ctx.db.insert('clubChannelReadReceipts', {
      clubId,
      channelId,
      userId: otherId,
      lastReadAt: 99,
    });
    return {
      memberId,
      otherId,
      outsiderId,
      clubId,
      channelId,
      privateChannelId,
    };
  });
  return { t, ...ids };
}

describe('chat audit repairs', () => {
  test('pins outside the newest page are returned independently and respect channel access', async () => {
    const { t, memberId, outsiderId, clubId, channelId, privateChannelId } =
      await fixture();
    const pinnedId = await t.run(async (ctx) => {
      const first = await ctx.db.insert('clubChannelMessages', {
        channelId,
        authorId: memberId,
        body: 'Old pinned plan',
        isPinned: true,
        pinnedAt: 1,
        createdAt: 1,
        updatedAt: 1,
      });
      for (let index = 2; index <= 45; index++)
        await ctx.db.insert('clubChannelMessages', {
          channelId,
          authorId: memberId,
          body: `Newer ${index}`,
          isPinned: false,
          createdAt: index,
          updatedAt: index,
        });
      return first;
    });
    const member = t.withIdentity({ subject: memberId });
    const page = await member.query(api.clubs.channels.getMessagePage, {
      clubId,
      channelId,
      paginationOpts: { cursor: null, numItems: 40 },
    });
    expect(page.page.some((message) => message._id === pinnedId)).toBe(false);
    const pins = await member.query(api.clubs.channels.listPinned, {
      clubId,
      channelId,
    });
    expect(pins.messages.map((message) => message._id)).toEqual([pinnedId]);
    expect(
      await t
        .withIdentity({ subject: outsiderId })
        .query(api.clubs.channels.listPinned, { clubId, channelId }),
    ).toEqual({ messages: [], hasMore: false });
    expect(
      await member.query(api.clubs.channels.listPinned, {
        clubId,
        channelId: privateChannelId,
      }),
    ).toEqual({ messages: [], hasMore: false });
  });

  test('retry identity creates one message and the author receipt advances at send time', async () => {
    const { t, memberId, clubId, channelId } = await fixture();
    const member = t.withIdentity({ subject: memberId });
    const args = {
      channelId,
      body: 'A retained draft',
      clientGeneratedId: 'same-retry-identity',
      clientSentAt: 100,
    };
    const id = await member.mutation(api.clubs.channels.postMessage, args);
    const retry = await member.mutation(api.clubs.channels.postMessage, args);
    expect(retry).toBe(id);
    const rows = await t.run((ctx) =>
      ctx.db
        .query('clubChannelMessages')
        .withIndex('by_authorId_and_clientGeneratedId', (q) =>
          q
            .eq('authorId', memberId)
            .eq('clientGeneratedId', args.clientGeneratedId),
        )
        .collect(),
    );
    expect(rows).toHaveLength(1);
    expect(
      await member.query(api.clubs.channels.getConversationContext, {
        clubId,
        channelId,
      }),
    ).toMatchObject({ lastReadAt: rows[0].createdAt });
  });

  test('only an edit sets edit provenance; pinning leaves it unchanged and includes club role', async () => {
    const { t, memberId, clubId, channelId } = await fixture();
    await t.run(async (ctx) => {
      const roleId = await ctx.db.insert('clubRoles', {
        clubId,
        name: 'Leader',
        permissions: { ...NO_CLUB_PERMISSIONS, pinMessages: true },
        isDefault: false,
        showInDirectory: true,
        position: 1,
        createdById: memberId,
        createdAt: 1,
        updatedAt: 1,
      });
      const membership = await ctx.db
        .query('clubMembers')
        .withIndex('by_clubId_and_userId', (q) =>
          q.eq('clubId', clubId).eq('userId', memberId),
        )
        .unique();
      await ctx.db.patch(membership!._id, { roleId });
    });
    const member = t.withIdentity({ subject: memberId });
    const messageId = await member.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: 'Original',
    });
    await member.mutation(api.clubs.channels.setPinned, {
      messageId,
      pinned: true,
    });
    let message = await member.query(api.clubs.channels.getMessage, {
      clubId,
      channelId,
      messageId,
    });
    expect(message?.editedAt).toBeNull();
    expect(message?.author.clubRole).toEqual({
      name: 'Leader',
      isSponsor: false,
    });
    await member.mutation(api.clubs.channels.updateMessage, {
      messageId,
      body: 'Changed',
    });
    message = await member.query(api.clubs.channels.getMessage, {
      clubId,
      channelId,
      messageId,
    });
    const editedAt = message?.editedAt;
    expect(editedAt).toBeTruthy();
    await member.mutation(api.clubs.channels.setPinned, {
      messageId,
      pinned: false,
    });
    expect(
      (
        await member.query(api.clubs.channels.getMessage, {
          clubId,
          channelId,
          messageId,
        })
      )?.editedAt,
    ).toBe(editedAt);
    const mentions = await member.query(api.clubs.channels.getMentionContext, {
      clubId,
      channelId,
    });
    expect(
      mentions?.members.find((person) => person.uniqueId === 'UNREAD-MEMBER'),
    ).toMatchObject({ avatarUrl: null, clubRole: 'Leader' });
  });
});
