/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { auditContextResolver } from "../audit/_context";

vi.mock("../../lib/currentUser", () => ({
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<"users">) : null;
    if (!user) throw new ConvexError("Unauthenticated");
    return user;
  },
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
}));

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const user = {
      uniqueId: "private-student-id",
      firstName: "Alex",
      lastName: "Johnson",
      roles: ["STUDENT" as const],
      gradeLevel: 9,
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "alex johnson",
      createdAt: 0,
      updatedAt: 0,
    };
    const viewerId = await ctx.db.insert("users", user);
    const authorId = await ctx.db.insert("users", {
      ...user,
      uniqueId: "private-author-id",
      authUserId: "private-auth-id",
      tokenIdentifier: "private-token-identifier",
      email: "private@example.com",
      firstName: "Ada",
      lastName: "Lovelace",
      preferredName: "Countess Ada",
      avatarUrl: "https://example.com/avatar.png",
      roles: ["TEACHER"],
      isStudent: false,
      isTeacherStaff: true,
      isDeveloper: true,
    });
    const announcementId = await ctx.db.insert("announcements", {
      authorId,
      title: "Field trip",
      body: "Permission slips are due Friday.",
      targetType: "SCHOOL_WIDE",
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      status: "ACTIVE",
      allowComments: true,
      isAdminGeneral: false,
      commentCount: 1,
      createdAt: 0,
      updatedAt: 0,
    });
    const commentId = await ctx.db.insert("comments", {
      announcementId,
      authorId,
      body: "Please return signed forms tomorrow.",
      createdAt: 1,
    });
    return { viewerId, authorId, announcementId, commentId };
  });
  return { t, ...ids };
}

async function readThread(
  t: ReturnType<typeof convexTest>,
  viewerId: Id<"users">,
  announcementId: Id<"announcements">,
) {
  const viewer = t.withIdentity({ subject: viewerId });
  const comments = await viewer.query(api.announcements.comments.list, { announcementId });
  const detail = await viewer.query(api.announcements.feed.get, { announcementId, now: 1 });
  return { comments, detail };
}

describe("announcement comment authors", () => {
  it("shares the safe profile projection with post authors in both thread queries", async () => {
    const { t, viewerId, authorId, announcementId } = await fixture();
    const { comments, detail } = await readThread(t, viewerId, announcementId);
    const expectedAuthor = {
      _id: authorId,
      firstName: "Ada",
      lastName: "Lovelace",
      preferredName: "Countess Ada",
      avatarUrl: "https://example.com/avatar.png",
      roles: ["TEACHER"],
      isDeveloper: true,
    };

    // Exact equality also refuses contact, student, and sign-in fields.
    expect(comments[0]?.author).toEqual(expectedAuthor);
    expect(detail?.comments[0]?.author).toEqual(expectedAuthor);
    expect(detail?.announcement.author).toEqual(expectedAuthor);
  });

  it("returns a null avatar when a comment author has no uploaded photo", async () => {
    const { t, viewerId, authorId, announcementId } = await fixture();
    await t.run((ctx) => ctx.db.patch(authorId, { avatarUrl: undefined }));
    const { comments, detail } = await readThread(t, viewerId, announcementId);

    expect(comments[0]?.author?.avatarUrl).toBeNull();
    expect(detail?.comments[0]?.author?.avatarUrl).toBeNull();
  });

  it("preserves comments with a null author after that account is deleted", async () => {
    const { t, viewerId, authorId, announcementId, commentId } = await fixture();
    await t.run((ctx) => ctx.db.delete(authorId));
    const { comments, detail } = await readThread(t, viewerId, announcementId);

    expect(comments).toMatchObject([{ _id: commentId, author: null }]);
    expect(detail?.comments).toMatchObject([{ _id: commentId, author: null }]);
  });

  it("does not expose comment author profiles without announcement access", async () => {
    const { t, viewerId, announcementId } = await fixture();
    await t.run((ctx) => ctx.db.patch(announcementId, {
      targetType: "GRADE",
      targetGrades: [12],
    }));
    const viewer = t.withIdentity({ subject: viewerId });

    await expect(viewer.query(api.announcements.comments.list, { announcementId }))
      .rejects.toThrow("Announcement not found");
    expect(await viewer.query(api.announcements.feed.get, { announcementId, now: 1 })).toBeNull();
  });

  it("keeps thread queries empty for an anonymous visitor", async () => {
    const { t, announcementId } = await fixture();

    expect(await t.query(api.announcements.comments.list, { announcementId })).toEqual([]);
    expect(await t.query(api.announcements.feed.get, { announcementId, now: 1 })).toBeNull();
  });
});

describe("announcement comment audit context", () => {
  it("retains the announcement title and relationship after both records are deleted", async () => {
    const { t, viewerId, announcementId } = await fixture();
    const viewer = t.withIdentity({ subject: viewerId });
    const commentId = await viewer.mutation(api.announcements.comments.add, {
      announcementId,
      body: "What time do we leave?",
    });
    await viewer.mutation(api.announcements.comments.remove, { commentId });
    await t.run((ctx) => ctx.db.delete(announcementId));

    const { events, contexts } = await t.run(async (ctx) => {
      const events = await ctx.db.query("auditEvents").collect();
      const resolve = auditContextResolver(ctx);
      return { events, contexts: await Promise.all(events.map(resolve)) };
    });
    expect(events.map((event) => event.action)).toEqual([
      "ANNOUNCEMENT_COMMENT_ADDED", "ANNOUNCEMENT_COMMENT_DELETED",
    ]);
    for (const event of events) {
      expect(event).toMatchObject({
        actorId: viewerId,
        entityType: "Comment",
        entityId: commentId,
        meta: { announcementId, title: "Field trip" },
      });
      expect(event.meta).not.toHaveProperty("body");
    }
    expect(contexts.map((context) => context.title)).toEqual(["Field trip", "Field trip"]);
    expect(await t.run((ctx) => ctx.db.get(commentId))).toBeNull();
  });

  it("does not permit a different user to remove a comment or emit a deletion event", async () => {
    const { t, viewerId, commentId } = await fixture();
    await expect(t.withIdentity({ subject: viewerId }).mutation(
      api.announcements.comments.remove, { commentId },
    )).rejects.toThrow("Unauthorized");
    expect(await t.run((ctx) => ctx.db.query("auditEvents").collect())).toEqual([]);
    expect(await t.run((ctx) => ctx.db.get(commentId))).not.toBeNull();
  });

  it("retains the parent ID when an author removes an orphaned comment", async () => {
    const { t, authorId, announcementId, commentId } = await fixture();
    await t.run((ctx) => ctx.db.delete(announcementId));
    await t.withIdentity({ subject: authorId }).mutation(
      api.announcements.comments.remove, { commentId },
    );
    const events = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      action: "ANNOUNCEMENT_COMMENT_DELETED",
      entityId: commentId,
      meta: { announcementId },
    });
    expect(events[0]?.meta).not.toHaveProperty("title");
    expect(await t.run((ctx) => ctx.db.get(commentId))).toBeNull();
  });
});
