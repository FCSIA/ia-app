/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  return {
    ...original,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      const user = await ctx.db.get(identity.subject as Id<"users">);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const studentId = await ctx.db.insert("users", {
      uniqueId: "BUG-STUDENT", firstName: "Bug", lastName: "Reporter", roles: ["STUDENT"],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: "bug reporter", createdAt: 1, updatedAt: 1,
    });
    const reviewerId = await ctx.db.insert("users", {
      uniqueId: "BUG-DEVELOPER", firstName: "Dev", lastName: "Reviewer", roles: ["STUDENT"],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, isDeveloper: true, canReviewFeedback: true, mustResetPassword: false,
      dashboardLayout: [], searchText: "dev reviewer", createdAt: 1, updatedAt: 1,
    });
    const reportId = await ctx.db.insert("moderationReports", {
      submitterId: studentId, contentType: "GENERAL", contentId: "report-page", reason: "Button is broken",
      feedbackKind: "BUG", status: "PENDING", isEscalated: false, createdAt: 1,
    });
    return { studentId, reviewerId, reportId };
  });
  return { t, ...ids };
}

describe("developer-approved bug rewards", () => {
  it("does not count submissions, anonymous calls, or an unprivileged approval", async () => {
    const { t, studentId, reportId } = await fixture();
    expect((await t.run((ctx) => ctx.db.get(studentId)))?.approvedBugCount).toBeUndefined();
    await expect(t.mutation(api.moderation.bugRewards.approve, { reportId })).rejects.toThrow();
    await expect(t.withIdentity({ subject: studentId }).mutation(api.moderation.bugRewards.approve, { reportId })).rejects.toThrow();
    expect((await t.run((ctx) => ctx.db.get(studentId)))?.approvedBugCount).toBeUndefined();
  });

  it("requires both developer designation and feedback-review access", async () => {
    const { t, reviewerId, reportId } = await fixture();
    await t.run((ctx) => ctx.db.patch(reviewerId, { canReviewFeedback: false }));
    await expect(t.withIdentity({ subject: reviewerId }).mutation(api.moderation.bugRewards.approve, { reportId })).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch(reviewerId, { canReviewFeedback: true, isDeveloper: false }));
    await expect(t.withIdentity({ subject: reviewerId }).mutation(api.moderation.bugRewards.approve, { reportId })).rejects.toThrow();
  });

  it("refuses ideas and dismissed bugs", async () => {
    const { t, reviewerId, reportId } = await fixture();
    const developer = t.withIdentity({ subject: reviewerId });
    await t.run((ctx) => ctx.db.patch(reportId, { feedbackKind: "OTHER" }));
    await expect(developer.mutation(api.moderation.bugRewards.approve, { reportId })).rejects.toThrow();
    await t.run((ctx) => ctx.db.patch(reportId, { feedbackKind: "BUG", status: "DISMISSED" }));
    await expect(developer.mutation(api.moderation.bugRewards.approve, { reportId })).rejects.toThrow();
  });

  it("increments exactly once per confirmed bug and saves the reviewer", async () => {
    const { t, studentId, reviewerId, reportId } = await fixture();
    const developer = t.withIdentity({ subject: reviewerId });
    expect(await developer.mutation(api.moderation.bugRewards.approve, { reportId })).toBe(1);
    expect(await developer.mutation(api.moderation.bugRewards.approve, { reportId })).toBe(1);
    const stored = await t.run(async (ctx) => ({ user: await ctx.db.get(studentId), report: await ctx.db.get(reportId) }));
    expect(stored.user?.approvedBugCount).toBe(1);
    expect(stored.report?.bugApprovedById).toBe(reviewerId);
    expect(stored.report?.bugApprovedAt).toEqual(expect.any(Number));
  });

  it("unlocks color customization at five approved bugs", async () => {
    const { t, studentId, reviewerId, reportId } = await fixture();
    const student = t.withIdentity({ subject: studentId });
    await expect(student.mutation(api.moderation.bugRewards.setColor, { color: "purple" })).rejects.toThrow();
    await t.withIdentity({ subject: reviewerId }).mutation(api.moderation.bugRewards.approve, { reportId });
    await t.run((ctx) => ctx.db.patch(studentId, { approvedBugCount: 5 }));
    await student.mutation(api.moderation.bugRewards.setColor, { color: "purple" });
    expect(await student.query(api.moderation.bugRewards.myReward, {})).toEqual({ approvedCount: 5, color: "purple" });
  });

  it("lists approved contributors for signed-in members without exposing inactive accounts", async () => {
    const { t, studentId, reviewerId } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.patch(studentId, { approvedBugCount: 5 });
      await ctx.db.patch(reviewerId, { approvedBugCount: 1 });
    });
    const args = { paginationOpts: { cursor: null, numItems: 10 } };
    await expect(t.query(api.moderation.bugRewards.hallOfFame, args)).rejects.toThrow();
    const member = t.withIdentity({ subject: studentId });
    const hall = await member.query(api.moderation.bugRewards.hallOfFame, args);
    expect(hall.page.map(({ name, approvedCount, isYou }) => ({ name, approvedCount, isYou }))).toEqual([
      { name: "Bug Reporter", approvedCount: 5, isYou: true },
      { name: "Dev Reviewer", approvedCount: 1, isYou: false },
    ]);
    const firstPage = await member.query(api.moderation.bugRewards.hallOfFame, {
      paginationOpts: { cursor: null, numItems: 1 },
    });
    expect(firstPage.page.map((entry) => entry.id)).toEqual([studentId]);
    const secondPage = await member.query(api.moderation.bugRewards.hallOfFame, {
      paginationOpts: { cursor: firstPage.continueCursor, numItems: 1 },
    });
    expect(secondPage.page.map((entry) => entry.id)).toEqual([reviewerId]);

    await t.run((ctx) => ctx.db.patch(reviewerId, { isActive: false }));
    const activeHall = await member.query(api.moderation.bugRewards.hallOfFame, args);
    expect(activeHall.page.map((entry) => entry.id)).toEqual([studentId]);
  });
});
