/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { ConvexError } from "convex/values";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", () => ({
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    const user = identity ? await ctx.db.get(identity.subject as Id<"users">) : null;
    if (!user) throw new ConvexError("Unauthenticated");
    return user;
  },
}));

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const user = {
      uniqueId: "reader",
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
    const readerId = await ctx.db.insert("users", user);
    const authorId = await ctx.db.insert("users", { ...user, uniqueId: "author" });
    const announcementId = await ctx.db.insert("announcements", {
      authorId,
      title: "Field trip",
      body: "Permission slips are due Friday.",
      targetType: "SCHOOL_WIDE",
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      status: "ACTIVE",
      allowComments: false,
      isAdminGeneral: false,
      commentCount: 0,
      createdAt: 0,
      updatedAt: 0,
    });
    const historicalId = await ctx.db.insert("auditEvents", {
      actorId: readerId,
      action: "ANNOUNCEMENT_READ",
      entityType: "Announcement",
      entityId: announcementId,
      createdAt: 1,
    });
    const otherReadId = await ctx.db.insert("announcementReads", {
      announcementId,
      userId: authorId,
      readAt: 1,
    });
    return { readerId, authorId, announcementId, historicalId, otherReadId };
  });
  return { t, ...ids };
}

describe("announcement read state", () => {
  it("preserves read/unread behavior and history without creating audit events", async () => {
    const { t, readerId, announcementId, historicalId, otherReadId } = await fixture();
    const reader = t.withIdentity({ subject: readerId });
    const args = { announcementId };
    const history = await t.run((ctx) => ctx.db.get(historicalId));

    await reader.mutation(api.announcements.engagement.markRead, args);
    const result = await reader.mutation(api.announcements.engagement.markRead, args);
    const reads = await t.run((ctx) => ctx.db.query("announcementReads").collect());
    expect(reads.filter((row) => row.userId === readerId)).toMatchObject([
      { announcementId, readAt: result.readAt },
    ]);

    await reader.mutation(api.announcements.engagement.markUnread, args);
    await reader.mutation(api.announcements.engagement.markUnread, args);
    expect(await t.run((ctx) => ctx.db.query("announcementReads").collect()))
      .toMatchObject([{ _id: otherReadId }]);
    expect(await t.run((ctx) => ctx.db.query("auditEvents").collect())).toEqual([history]);
  });

  it.each(["markRead", "markUnread"] as const)("still enforces access for %s", async (action) => {
    const { t, readerId, announcementId } = await fixture();
    await t.run((ctx) => ctx.db.patch(announcementId, { targetType: "GRADE", targetGrades: [12] }));
    const before = await t.run((ctx) => ctx.db.query("announcementReads").collect());
    await expect(t.mutation(api.announcements.engagement[action], { announcementId }))
      .rejects.toThrow("Unauthenticated");
    await expect(t.withIdentity({ subject: readerId }).mutation(
      api.announcements.engagement[action], { announcementId },
    )).rejects.toThrow("Announcement not found");
    expect(await t.run((ctx) => ctx.db.query("announcementReads").collect())).toEqual(before);
  });

  it("continues auditing announcement content changes", async () => {
    const { t, authorId, announcementId } = await fixture();
    await t.withIdentity({ subject: authorId }).mutation(api.announcements.engagement.archive, { announcementId });
    const events = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(events).toHaveLength(2);
    expect(events).toContainEqual(expect.objectContaining({ action: "ANNOUNCEMENT_ARCHIVED", entityId: announcementId }));
  });
});
