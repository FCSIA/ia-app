/// <reference types="vite/client" />
import { convexTest } from 'convex-test';
import { describe, expect, test, vi } from 'vitest';
import { api } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import type { QueryCtx } from '../_generated/server';
import schema from '../schema';

vi.mock('../../lib/currentUser', () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<'users'>) : null;
  },
}));
const modules = import.meta.glob('/src/**/*.*s');

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const makeUser = (uniqueId: string) => ctx.db.insert('users', {
      uniqueId, firstName: uniqueId, lastName: 'Test', roles: ['STUDENT'],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId,
      createdAt: 1, updatedAt: 1,
    });
    const memberId = await makeUser('FILES-MEMBER');
    const outsiderId = await makeUser('FILES-OUTSIDER');
    const clubId = await ctx.db.insert('clubs', {
      name: 'Files Club', joinPolicy: 'OPEN', isActive: true, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert('clubMembers', { clubId, userId: memberId, role: 'MEMBER', joinedAt: 1 });
    const channelId = await ctx.db.insert('clubChannels', {
      clubId, name: 'General', visibility: 'PUBLIC', createdById: memberId, createdAt: 1, updatedAt: 1,
    });
    const rootId = await ctx.db.insert('clubChannelMessages', {
      channelId, authorId: memberId, body: 'Original', isPinned: false, createdAt: 1, updatedAt: 1,
    });
    const replyId = await ctx.db.insert('clubChannelMessages', {
      channelId, authorId: memberId, body: 'Older reply', parentMessageId: rootId,
      isPinned: false, createdAt: 2, updatedAt: 2,
    });
    const attachmentId = await ctx.db.insert('clubChannelMessageAttachments', {
      messageId: replyId, fileName: 'old-proof.pdf', fileUrl: 'https://example.com/proof.pdf',
      mimeType: 'application/pdf', createdAt: 2,
    });
    for (let index = 0; index < 305; index++) {
      await ctx.db.insert('clubChannelMessages', {
        channelId, authorId: memberId, body: 'Newer message', isPinned: false,
        createdAt: index + 3, updatedAt: index + 3,
      });
    }
    const deletedId = await ctx.db.insert('clubChannelMessages', {
      channelId, authorId: memberId, body: '', isPinned: false, deletedAt: 500, createdAt: 499, updatedAt: 500,
    });
    await ctx.db.insert('clubChannelMessageAttachments', {
      messageId: deletedId, fileName: 'deleted.pdf', fileUrl: 'https://example.com/deleted.pdf', createdAt: 499,
    });
    return { memberId, outsiderId, clubId, channelId, rootId, replyId, attachmentId };
  });
  return { t, ...ids };
}

describe('channel attachment library', () => {
  test('continues through empty pages to old reply attachments and retains thread provenance', async () => {
    const { t, memberId, clubId, channelId, rootId, replyId, attachmentId } = await fixture();
    const member = t.withIdentity({ subject: memberId });
    const first = await member.query(api.clubs.shared.listChannelAttachments, {
      clubId, channelId, paginationOpts: { cursor: null, numItems: 30 },
    });
    expect(first.page).toEqual([]);
    expect(first.isDone).toBe(false);
    let page = first;
    const attachments = [...first.page];
    for (let count = 0; !page.isDone && count < 20; count++) {
      page = await member.query(api.clubs.shared.listChannelAttachments, {
        clubId, channelId, paginationOpts: { cursor: page.continueCursor, numItems: 30 },
      });
      attachments.push(...page.page);
    }
    expect(page.isDone).toBe(true);
    expect(attachments).toMatchObject([{
      _id: attachmentId, messageId: replyId, threadRootId: rootId, fileName: 'old-proof.pdf',
    }]);
  });

  test('does not disclose attachments without channel access', async () => {
    const { t, memberId, outsiderId, clubId, channelId } = await fixture();
    const args = { clubId, channelId, paginationOpts: { cursor: null, numItems: 30 } };
    expect((await t.query(api.clubs.shared.listChannelAttachments, args)).page).toEqual([]);
    expect((await t.withIdentity({ subject: outsiderId }).query(api.clubs.shared.listChannelAttachments, args)).page).toEqual([]);
    await t.run((ctx) => ctx.db.patch(channelId, { visibility: 'PRIVATE' }));
    expect((await t.withIdentity({ subject: memberId }).query(api.clubs.shared.listChannelAttachments, args)).page).toEqual([]);
  });
});
