/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, test, vi } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

afterEach(() => vi.useRealTimers());

describe("permanent club deletion", () => {
  test("removes club-owned records while retaining moderation history", async () => {
    vi.useFakeTimers();
    const t = convexTest(schema, modules);

    const ids = await t.run(async (ctx) => {
      const now = 1;
      const userId = await ctx.db.insert("users", {
        uniqueId: "ADMIN001",
        firstName: "Super",
        lastName: "Admin",
        roles: ["SUPER_ADMIN"],
        isStudent: false,
        isTeacherStaff: true,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: "Super Admin ADMIN001",
        createdAt: now,
        updatedAt: now,
      });
      const clubId = await ctx.db.insert("clubs", {
        name: "Delete Me",
        joinPolicy: "OPEN",
        isActive: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("clubMembers", {
        clubId,
        userId,
        role: "LEADER",
        joinedAt: now,
      });
      const unitId = await ctx.db.insert("clubUnits", {
        clubId,
        name: "Team",
        joinPolicy: "ASSIGN_ONLY",
        position: 0,
        isActive: true,
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("clubUnitMembers", {
        clubId,
        unitId,
        userId,
        role: "MEMBER",
        joinedAt: now,
        updatedAt: now,
      });
      const tagId = await ctx.db.insert("clubTags", {
        clubId,
        name: "Leads",
        slug: "leads",
        createdById: userId,
        createdAt: now,
      });
      await ctx.db.insert("clubTagMembers", { tagId, userId, createdAt: now });
      const channelId = await ctx.db.insert("clubChannels", {
        clubId,
        name: "general",
        visibility: "PUBLIC",
        createdById: userId,
        createdAt: now,
        updatedAt: now,
      });
      const messageId = await ctx.db.insert("clubChannelMessages", {
        channelId,
        authorId: userId,
        body: "Goodbye",
        isPinned: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("clubChannelMessageReactions", {
        messageId,
        userId,
        emoji: "👍",
        createdAt: now,
      });
      const announcementId = await ctx.db.insert("announcements", {
        authorId: userId,
        title: "Club update",
        body: "Update",
        targetType: "CLUB",
        targetGrades: [],
        targetMajorPathways: [],
        targetMinorPathways: [],
        clubId,
        status: "ACTIVE",
        allowComments: true,
        isAdminGeneral: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("comments", {
        announcementId,
        authorId: userId,
        body: "Comment",
        createdAt: now,
      });
      const eventId = await ctx.db.insert("events", {
        authorId: userId,
        clubId,
        status: "APPROVED",
        type: "GENERAL",
        title: "Club event",
        startAt: now,
        allowedMajorPathways: [],
        allowedMinorPathways: [],
        requiredMajorWorkshopCount: 0,
        isInactive: false,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("eventApprovals", {
        eventId,
        sponsorId: userId,
        status: "APPROVED",
        createdAt: now,
      });
      const reportId = await ctx.db.insert("moderationReports", {
        submitterId: userId,
        contentType: "CLUB_MESSAGE",
        contentId: messageId,
        clubId,
        reason: "History",
        status: "RESOLVED",
        isEscalated: false,
        createdAt: now,
      });

      return { clubId, userId, reportId };
    });

    await t.mutation(internal.clubs.clubDeletion.cleanupDeletedClub, {
      clubId: ids.clubId,
      actorId: ids.userId,
      clubName: "Delete Me",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const remaining = await t.run(async (ctx) => ({
      club: await ctx.db.get(ids.clubId),
      report: await ctx.db.get(ids.reportId),
      member: await ctx.db.query("clubMembers").first(),
      unit: await ctx.db.query("clubUnits").first(),
      unitMember: await ctx.db.query("clubUnitMembers").first(),
      channel: await ctx.db.query("clubChannels").first(),
      message: await ctx.db.query("clubChannelMessages").first(),
      reaction: await ctx.db.query("clubChannelMessageReactions").first(),
      tag: await ctx.db.query("clubTags").first(),
      tagMember: await ctx.db.query("clubTagMembers").first(),
      announcement: await ctx.db.query("announcements").first(),
      comment: await ctx.db.query("comments").first(),
      event: await ctx.db.query("events").first(),
      approval: await ctx.db.query("eventApprovals").first(),
      audit: await ctx.db
        .query("auditEvents")
        .withIndex("by_entityType_and_entityId_and_createdAt", (q) =>
          q.eq("entityType", "Club").eq("entityId", ids.clubId),
        )
        .first(),
    }));

    expect(remaining).toMatchObject({
      club: null,
      member: null,
      unit: null,
      unitMember: null,
      channel: null,
      message: null,
      reaction: null,
      tag: null,
      tagMember: null,
      announcement: null,
      comment: null,
      event: null,
      approval: null,
    });
    expect(remaining.report?._id).toBe(ids.reportId);
    expect(remaining.audit?.action).toBe("CLUB_DELETED");
  });
});
