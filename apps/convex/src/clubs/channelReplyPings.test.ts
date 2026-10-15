/// <reference types="vite/client" />

import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
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

afterEach(() => {
  vi.useRealTimers();
});

async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const makeUser = (uniqueId: string) =>
      ctx.db.insert("users", {
        uniqueId,
        firstName: uniqueId,
        lastName: "Test",
        roles: ["STUDENT"],
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
    const originalId = await makeUser("ORIGINAL");
    const replierId = await makeUser("REPLIER");
    const bystanderId = await makeUser("BYSTANDER");
    const clubId = await ctx.db.insert("clubs", {
      name: "Reply Club",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    for (const userId of [originalId, replierId, bystanderId]) {
      await ctx.db.insert("clubMembers", {
        clubId,
        userId,
        role: "MEMBER",
        joinedAt: 1,
      });
    }
    const tagId = await ctx.db.insert("clubTags", {
      clubId,
      name: "Crew",
      slug: "crew",
      createdById: originalId,
      createdAt: 1,
    });
    await ctx.db.insert("clubTagMembers", {
      tagId,
      userId: bystanderId,
      createdAt: 1,
    });
    const channelId = await ctx.db.insert("clubChannels", {
      clubId,
      name: "General",
      visibility: "PUBLIC",
      createdById: originalId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { originalId, replierId, bystanderId, clubId, channelId };
  });
  return { t, ...ids };
}

async function pageFor(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  userId: Id<"users">,
  clubId: Id<"clubs">,
  channelId: Id<"clubChannels">,
) {
  const page = await t
    .withIdentity({ subject: userId })
    .query(api.clubs.channels.getMessagePage, {
      clubId,
      channelId,
      paginationOpts: { numItems: 20, cursor: null },
    });
  return new Map(page.page.map((message) => [message.body, message]));
}

describe("replies and mentions that reach the viewer", () => {
  test("a reply names the original author even outside loaded history", async () => {
    const { t, originalId, replierId, clubId, channelId } = await fixture();
    const originalMessageId = await t
      .withIdentity({ subject: originalId })
      .mutation(api.clubs.channels.postMessage, {
        channelId,
        body: "Who is bringing the banner?",
      });
    await t.withIdentity({ subject: replierId }).mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "I can",
      replyToMessageId: originalMessageId,
    });

    const byBody = await pageFor(t, originalId, clubId, channelId);
    expect(byBody.get("I can")?.replyPreview).toMatchObject({
      _id: originalMessageId,
      author: { _id: originalId },
      body: "Who is bringing the banner?",
      isDeleted: false,
    });
    expect(byBody.get("Who is bringing the banner?")?.replyPreview).toBeNull();
  });

  test("notifies the replied-to author once, and never for replying to yourself", async () => {
    const { t, originalId, replierId, channelId } = await fixture();
    const original = t.withIdentity({ subject: originalId });
    const originalMessageId = await original.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "Meeting moved to 4",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await t.withIdentity({ subject: replierId }).mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "Got it",
      replyToMessageId: originalMessageId,
    });
    await original.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "Also bring laptops",
      replyToMessageId: originalMessageId,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const deliveries = await t.run((ctx) =>
      ctx.db
        .query("notificationDeliveries")
        .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", originalId))
        .collect(),
    );
    const replyDeliveries = deliveries.filter(
      (delivery) => delivery.category === "CLUB_CHANNEL_THREAD",
    );
    expect(replyDeliveries).toHaveLength(1);
    expect(replyDeliveries[0]).toMatchObject({
      title: "REPLIER Test replied to you in #General",
      body: "Got it",
    });
  });

  test("flags direct and group mentions only for the people they reached", async () => {
    const { t, originalId, replierId, bystanderId, clubId, channelId } = await fixture();
    const replier = t.withIdentity({ subject: replierId });
    await replier.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "@ORIGINAL can you check this",
    });
    await replier.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "@crew meet at the door",
    });
    await replier.mutation(api.clubs.channels.postMessage, {
      channelId,
      body: "email me @ noon",
    });

    const forOriginal = await pageFor(t, originalId, clubId, channelId);
    const forBystander = await pageFor(t, bystanderId, clubId, channelId);
    const forReplier = await pageFor(t, replierId, clubId, channelId);

    expect(forOriginal.get("@ORIGINAL can you check this")?.mentionsViewer).toBe(true);
    expect(forOriginal.get("@crew meet at the door")?.mentionsViewer).toBe(false);
    expect(forBystander.get("@ORIGINAL can you check this")?.mentionsViewer).toBe(false);
    expect(forBystander.get("@crew meet at the door")?.mentionsViewer).toBe(true);
    expect(forBystander.get("email me @ noon")?.mentionsViewer).toBe(false);
    // Your own messages never highlight for you.
    expect(forReplier.get("@crew meet at the door")?.mentionsViewer).toBe(false);
  });
});
