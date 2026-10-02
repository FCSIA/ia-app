/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../../lib/currentUser", () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.db.get(identity.subject as Id<"users">);
  },
}));

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const makeUser = (uniqueId: string) => ctx.db.insert("users", {
      uniqueId, firstName: uniqueId, lastName: "Test", roles: ["STUDENT"],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId,
      createdAt: 1, updatedAt: 1,
    });
    const memberId = await makeUser("UNREAD-MEMBER");
    const otherId = await makeUser("UNREAD-OTHER");
    const outsiderId = await makeUser("UNREAD-OUTSIDER");
    const clubId = await ctx.db.insert("clubs", {
      name: "Unread Club", joinPolicy: "OPEN", isActive: true, createdAt: 1, updatedAt: 1,
    });
    for (const userId of [memberId, otherId]) {
      await ctx.db.insert("clubMembers", { clubId, userId, role: "MEMBER", joinedAt: 1 });
    }
    const channelId = await ctx.db.insert("clubChannels", {
      clubId, name: "General", visibility: "PUBLIC", createdById: memberId, createdAt: 1, updatedAt: 1,
    });
    const privateChannelId = await ctx.db.insert("clubChannels", {
      clubId, name: "Private", visibility: "PRIVATE", createdById: memberId, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("clubChannelReadReceipts", { clubId, channelId, userId: memberId, lastReadAt: 10 });
    await ctx.db.insert("clubChannelReadReceipts", { clubId, channelId, userId: otherId, lastReadAt: 99 });
    return { memberId, otherId, outsiderId, clubId, channelId, privateChannelId };
  });
  return { t, ...ids };
}

describe("channel conversation read boundary", () => {
  test("returns only the signed-in viewer's receipt and advances through authoritative createdAt", async () => {
    const { t, memberId, otherId, clubId, channelId } = await fixture();
    const member = t.withIdentity({ subject: memberId });
    expect(await member.query(api.clubs.channels.getConversationContext, { clubId, channelId })).toMatchObject({ lastReadAt: 10 });
    const messageId = await t.run((ctx) => ctx.db.insert("clubChannelMessages", {
      channelId, authorId: otherId, body: "Unread", isPinned: false, createdAt: 20, updatedAt: 20,
    }));
    await member.mutation(api.clubs.channels.markRead, { channelId, throughMessageId: messageId });
    expect(await member.query(api.clubs.channels.getConversationContext, { clubId, channelId })).toMatchObject({ lastReadAt: 20 });
    expect(await t.withIdentity({ subject: otherId }).query(api.clubs.channels.getConversationContext, { clubId, channelId })).toMatchObject({ lastReadAt: 99 });
  });
  test("returns zero without a receipt, and no context to unauthenticated or unauthorized viewers", async () => {
    const { t, memberId, outsiderId, clubId, channelId, privateChannelId } = await fixture();
    await t.run(async (ctx) => {
      const receipt = await ctx.db.query("clubChannelReadReceipts").withIndex("by_userId_and_channelId", q => q.eq("userId", memberId).eq("channelId", channelId)).unique();
      await ctx.db.delete(receipt!._id);
    });
    const member = t.withIdentity({ subject: memberId });
    expect(await member.query(api.clubs.channels.getConversationContext, { clubId, channelId })).toMatchObject({ lastReadAt: 0 });
    expect(await t.query(api.clubs.channels.getConversationContext, { clubId, channelId })).toBeNull();
    expect(await t.withIdentity({ subject: outsiderId }).query(api.clubs.channels.getConversationContext, { clubId, channelId })).toBeNull();
    expect(await member.query(api.clubs.channels.getConversationContext, { clubId, channelId: privateChannelId })).toBeNull();
  });
});