/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { adjustCommentCount } from "./_lib";
import { serializeAnnouncements } from "./serialize";

const modules = import.meta.glob("../**/*.*s");

async function seed(
  t: ReturnType<typeof convexTest>,
  { commentCount, comments }: { commentCount?: number; comments: number },
) {
  return t.run(async (ctx) => {
    const authorId = await ctx.db.insert("users", {
      uniqueId: "author-1",
      firstName: "Ada",
      lastName: "Lovelace",
      roles: ["TEACHER"],
      isStudent: false,
      isTeacherStaff: true,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "ada lovelace",
      createdAt: 0,
      updatedAt: 0,
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
      commentCount,
      createdAt: 0,
      updatedAt: 0,
    });

    for (let index = 0; index < comments; index += 1) {
      await ctx.db.insert("comments", {
        announcementId,
        authorId,
        body: `comment ${index}`,
        createdAt: index,
      });
    }

    return { authorId, announcementId };
  });
}

async function countOf(
  t: ReturnType<typeof convexTest>,
  announcementId: Id<"announcements">,
  viewerId: Id<"users">,
) {
  return t.run(async (ctx) => {
    const ann = await ctx.db.get(announcementId);
    const [serialized] = await serializeAnnouncements(ctx, [ann!], viewerId);
    return serialized.commentCount;
  });
}

describe("announcement comment counter", () => {
  it("reports the real count for rows written before the counter existed", async () => {
    const t = convexTest(schema, modules);
    const { announcementId, authorId } = await seed(t, { comments: 3 });

    expect(await countOf(t, announcementId, authorId)).toBe(3);
  });

  it("adopts the true count the first time a legacy row is adjusted", async () => {
    const t = convexTest(schema, modules);
    const { announcementId, authorId } = await seed(t, { comments: 2 });

    await t.run(async (ctx) => {
      const ann = await ctx.db.get(announcementId);
      await adjustCommentCount(ctx, ann!, 1);
      await ctx.db.insert("comments", {
        announcementId,
        authorId,
        body: "the new one",
        createdAt: 10,
      });
    });

    expect(await countOf(t, announcementId, authorId)).toBe(3);
  });

  it("tracks additions and removals once the counter is set", async () => {
    const t = convexTest(schema, modules);
    const { announcementId, authorId } = await seed(t, { commentCount: 5, comments: 5 });

    await t.run(async (ctx) => {
      const ann = await ctx.db.get(announcementId);
      await adjustCommentCount(ctx, ann!, -1);
    });
    expect(await countOf(t, announcementId, authorId)).toBe(4);

    await t.run(async (ctx) => {
      const ann = await ctx.db.get(announcementId);
      await adjustCommentCount(ctx, ann!, 1);
    });
    expect(await countOf(t, announcementId, authorId)).toBe(5);
  });

  it("never reports a negative count", async () => {
    const t = convexTest(schema, modules);
    const { announcementId, authorId } = await seed(t, { commentCount: 0, comments: 0 });

    await t.run(async (ctx) => {
      const ann = await ctx.db.get(announcementId);
      await adjustCommentCount(ctx, ann!, -1);
    });

    expect(await countOf(t, announcementId, authorId)).toBe(0);
  });
});
