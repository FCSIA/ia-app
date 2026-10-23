/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

vi.mock("../../lib/currentUser", () => ({
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
    const makeUser = (name: string) => ctx.db.insert("users", {
      uniqueId: name,
      firstName: name,
      lastName: "Test",
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: name,
      createdAt: 1,
      updatedAt: 1,
    });
    const studentId = await makeUser("Student");
    const reviewerId = await makeUser("Reviewer");
    const outsiderId = await makeUser("Outsider");
    const clubId = await ctx.db.insert("clubs", {
      name: "Service Club", joinPolicy: "OPEN", isActive: true,
      volunteerTrackingEnabled: true, createdAt: 1, updatedAt: 1,
    });
    const studentRoleId = await ctx.db.insert("clubRoles", {
      clubId, name: "Member", permissions: NO_CLUB_PERMISSIONS,
      createdById: studentId, createdAt: 1, updatedAt: 1,
    });
    const reviewerRoleId = await ctx.db.insert("clubRoles", {
      clubId, name: "Reviewer", permissions: { ...NO_CLUB_PERMISSIONS, reviewVolunteerHours: true },
      createdById: reviewerId, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("clubMembers", { clubId, userId: studentId, roleId: studentRoleId, joinedAt: 1 });
    await ctx.db.insert("clubMembers", { clubId, userId: reviewerId, roleId: reviewerRoleId, joinedAt: 1 });
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const storageId = await ctx.storage.store(new Blob([png], { type: "image/png" }));
    const proofUploadId = await ctx.db.insert("volunteerProofUploads", {
      uploaderId: studentId, storageId, mimeType: "image/png", size: png.length, createdAt: 1,
    });
    return { studentId, reviewerId, outsiderId, clubId, proofUploadId };
  });
  return { t, ...ids };
}

describe("club volunteer hours", () => {
  test("requires club enablement, membership, and a proof owned by the submitter", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } = await fixture();
    const input = { clubId, activity: "Park cleanup", serviceDate: "2026-01-15", minutes: 120, proofUploadId };
    await expect(t.withIdentity({ subject: outsiderId }).mutation(api.clubs.volunteering.submit, input)).rejects.toThrow();
    await expect(t.withIdentity({ subject: reviewerId }).mutation(api.clubs.volunteering.submit, input)).rejects.toThrow(/Proof image not found/);
    await t.run((ctx) => ctx.db.patch(clubId, { volunteerTrackingEnabled: false }));
    await expect(t.withIdentity({ subject: studentId }).mutation(api.clubs.volunteering.submit, input)).rejects.toThrow(/not enabled/);
    await t.run((ctx) => ctx.db.patch(clubId, { volunteerTrackingEnabled: true }));
    const logId = await t.withIdentity({ subject: studentId }).mutation(api.clubs.volunteering.submit, input);
    expect(logId).toBeTruthy();
    await expect(t.withIdentity({ subject: studentId }).mutation(api.clubs.volunteering.submit, input)).rejects.toThrow(/Proof image not found/);
  });

  test("keeps logs private, rejects self-review, and counts hours only after approval", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } = await fixture();
    const student = t.withIdentity({ subject: studentId });
    const reviewer = t.withIdentity({ subject: reviewerId });
    const logId = await student.mutation(api.clubs.volunteering.submit, {
      clubId, activity: "Library shelving", serviceDate: "2026-01-15", minutes: 150, proofUploadId,
    });
    expect(await student.query(api.clubs.volunteering.getMySummary, { clubId })).toMatchObject({
      approvedMinutes: 0, pendingMinutes: 150, pendingCount: 1,
    });
    const paginationOpts = { numItems: 20, cursor: null };
    expect((await student.query(api.clubs.volunteering.listMine, { clubId, paginationOpts })).page).toHaveLength(1);
    await expect(student.query(api.clubs.volunteering.listPending, { clubId, paginationOpts })).rejects.toThrow(/Not authorized/);
    await expect(t.withIdentity({ subject: outsiderId }).query(api.clubs.volunteering.listMine, { clubId, paginationOpts })).rejects.toThrow();
    await expect(t.withIdentity({ subject: outsiderId }).query(api.clubs.volunteering.getMySummary, { clubId })).rejects.toThrow(/Not a club member/);
    expect((await reviewer.query(api.clubs.volunteering.listPending, { clubId, paginationOpts })).page).toHaveLength(1);
    await expect(student.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "APPROVED" })).rejects.toThrow(/Not authorized/);
    await reviewer.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "APPROVED" });
    expect(await student.query(api.clubs.volunteering.getMySummary, { clubId })).toMatchObject({
      approvedMinutes: 150, approvedCount: 1, pendingMinutes: 0, pendingCount: 0,
    });
    await expect(reviewer.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "APPROVED" })).rejects.toThrow(/already been reviewed/);
  });

  test("requires a decline reason and prevents a permitted reviewer from approving their own entry", async () => {
    const { t, reviewerId, studentId, clubId } = await fixture();
    const reviewer = t.withIdentity({ subject: reviewerId });
    const student = t.withIdentity({ subject: studentId });
    const proofUploadId = await t.run(async (ctx) => {
      const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
      const storageId = await ctx.storage.store(new Blob([bytes], { type: "image/png" }));
      return ctx.db.insert("volunteerProofUploads", {
        uploaderId: reviewerId, storageId, mimeType: "image/png", size: bytes.length, createdAt: 1,
      });
    });
    const logId = await reviewer.mutation(api.clubs.volunteering.submit, {
      clubId, activity: "Food bank", serviceDate: "2026-01-15", minutes: 90, proofUploadId,
    });
    await expect(reviewer.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "APPROVED" })).rejects.toThrow(/own hours/);
    await expect(student.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "DECLINED", note: "No proof" })).rejects.toThrow(/Not authorized/);
    await t.run(async (ctx) => {
      const membership = await ctx.db.query("clubMembers")
        .withIndex("by_clubId_and_userId", (q) => q.eq("clubId", clubId).eq("userId", studentId)).unique();
      await ctx.db.patch(membership!.roleId!, { permissions: { ...NO_CLUB_PERMISSIONS, reviewVolunteerHours: true } });
    });
    await expect(student.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "DECLINED" })).rejects.toThrow(/Explain why/);
    await student.mutation(api.clubs.volunteering.review, { clubId, logId, decision: "DECLINED", note: "Hours need clarification" });
    expect(await reviewer.query(api.clubs.volunteering.getMySummary, { clubId })).toMatchObject({
      approvedMinutes: 0, pendingMinutes: 0, declinedCount: 1,
    });
  });

  test("serves proof only after a fresh authenticated club access check", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } = await fixture();
    const logId = await t.withIdentity({ subject: studentId }).mutation(api.clubs.volunteering.submit, {
      clubId, activity: "Campus cleanup", serviceDate: "2026-01-15", minutes: 60, proofUploadId,
    });
    const path = `/club-volunteer-proof?logId=${logId}`;
    expect((await t.fetch(path)).status).toBe(401);
    expect((await t.withIdentity({ subject: outsiderId }).fetch(path)).status).toBe(404);
    expect((await t.withIdentity({ subject: studentId }).fetch(path)).status).toBe(200);
    expect((await t.withIdentity({ subject: reviewerId }).fetch(path)).status).toBe(200);
    await t.run((ctx) => ctx.db.patch(clubId, { volunteerTrackingEnabled: false }));
    expect((await t.withIdentity({ subject: studentId }).fetch(path)).status).toBe(404);
  });
});
