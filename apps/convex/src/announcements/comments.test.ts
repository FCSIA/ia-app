/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
}));

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
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
