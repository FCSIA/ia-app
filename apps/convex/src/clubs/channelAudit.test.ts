/// <reference types="vite/client" />

import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

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
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      uniqueId: "AUDIT",
      firstName: "Audit",
      lastName: "Test",
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "audit",
      createdAt: 1,
      updatedAt: 1,
    });
    const clubId = await ctx.db.insert("clubs", {
      name: "Audit Club",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("clubMembers", { clubId, userId, role: "MEMBER", joinedAt: 1 });
    const channelId = await ctx.db.insert("clubChannels", {
      clubId,
      name: "General",
      visibility: "PUBLIC",
      createdById: userId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { userId, clubId, channelId };
  });
  return { t, ...ids, user: t.withIdentity({ subject: ids.userId }) };
}

const auditMeta = (t: Awaited<ReturnType<typeof fixture>>["t"], action: string) =>
  t.run(async (ctx) => {
    const rows = await ctx.db.query("auditEvents").collect();
    return rows.filter((row) => row.action === action).map((row) => row.meta);
  });

describe("channel message audit metadata", () => {
  test("records bounded content metadata and conversation context", async () => {
    const { t, user, clubId, channelId } = await fixture();
    const parentId = await user.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "x".repeat(300),
    });
    await user.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "A complete chat message",
      bodyMarkdown: "**A complete chat message**",
      parentMessageId: parentId,
    });

    const [first, reply] = await auditMeta(t, "CLUB_CHANNEL_MESSAGE_POSTED");
    expect(first).toMatchObject({ clubId, channelId, bodyLength: 300 });
    // The table preview is bounded and never repeats the stored message.
    expect((first as { bodyPreview: string }).bodyPreview).toHaveLength(240);
    expect(first).not.toHaveProperty("body");
    expect(reply).toEqual({
      clubId,
      channelId,
      parentMessageId: parentId,
      replyToMessageId: null,
      bodyPreview: "A complete chat message",
      bodyLength: 23,
      markdownLength: 27,
      attachmentCount: 0,
      hasPoll: false,
    });
  });

  test("records a normalized reaction with its conversation context", async () => {
    const { t, user, clubId, channelId } = await fixture();
    const messageId = await user.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "React to me",
    });
    await user.mutation(api.clubs.channels.toggleReaction, { messageId, emoji: "FIRE" });
    await user.mutation(api.clubs.channels.toggleReaction, { messageId, emoji: "FIRE" });

    expect(await auditMeta(t, "CLUB_CHANNEL_MESSAGE_REACTION_ADDED")).toEqual([
      { clubId, channelId, emoji: "FIRE", removedReactionCount: 0 },
    ]);
    expect(await auditMeta(t, "CLUB_CHANNEL_MESSAGE_REACTION_REMOVED")).toEqual([
      { clubId, channelId, emoji: "FIRE", removedReactionCount: 1 },
    ]);
  });
});
