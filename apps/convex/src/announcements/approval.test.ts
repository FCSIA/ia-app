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
  const { approverId, announcementId } = await t.run(async (ctx) => {
    const user = {
      firstName: "Alex",
      lastName: "Example",
      isStudent: false,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "alex example",
      createdAt: 0,
      updatedAt: 0,
    };
    const approverId = await ctx.db.insert("users", {
      ...user,
      uniqueId: "APPROVER-1",
      roles: ["ADMIN"],
    });
    await ctx.db.insert("users", {
      ...user,
      uniqueId: "READER-1",
      firstName: "Sam",
      roles: ["STUDENT"],
      isStudent: true,
    });
    const announcementId = await ctx.db.insert("announcements", {
      authorId: approverId,
      title: "Pending update",
      body: "This announcement is awaiting review.",
      targetType: "SCHOOL_WIDE",
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      status: "PENDING_APPROVAL",
      allowComments: false,
      isAdminGeneral: false,
      createdAt: 0,
      updatedAt: 0,
    });
    return { approverId, announcementId };
  });
  return { t, approverId, announcementId };
}

async function sideEffects(t: ReturnType<typeof convexTest>) {
  return t.run(async (ctx) => ({
    deliveries: await ctx.db.query("notificationDeliveries").collect(),
    audits: await ctx.db.query("auditEvents").collect(),
  }));
}

describe("announcement approval transitions", () => {
  it("delivers and audits once when approval is requested twice", async () => {
    const { t, approverId, announcementId } = await fixture();
    const approver = t.withIdentity({ subject: approverId });

    await approver.mutation(api.announcements.feed.approve, { announcementId });
    const first = await sideEffects(t);
    expect(first.deliveries).toHaveLength(2);
    expect(first.audits.map((event) => event.action)).toEqual(["ANNOUNCEMENT_APPROVED"]);

    await expect(approver.mutation(api.announcements.feed.approve, { announcementId }))
      .rejects.toThrow("Only pending announcements can be approved");
    expect(await sideEffects(t)).toEqual(first);
    expect((await t.run((ctx) => ctx.db.get(announcementId)))?.status).toBe("ACTIVE");
  });

  it("delivers once for two overlapping approval requests", async () => {
    const { t, approverId, announcementId } = await fixture();
    const approver = t.withIdentity({ subject: approverId });
    const results = await Promise.allSettled([
      approver.mutation(api.announcements.feed.approve, { announcementId }),
      approver.mutation(api.announcements.feed.approve, { announcementId }),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual(["fulfilled", "rejected"]);
    const effects = await sideEffects(t);
    expect(effects.deliveries).toHaveLength(2);
    expect(effects.audits.map((event) => event.action)).toEqual(["ANNOUNCEMENT_APPROVED"]);
  });

  it.each(["ARCHIVED", "REJECTED", "EXPIRED"] as const)(
    "does not reactivate a %s announcement",
    async (status) => {
      const { t, approverId, announcementId } = await fixture();
      await t.run((ctx) => ctx.db.patch(announcementId, { status }));

      await expect(t.withIdentity({ subject: approverId }).mutation(
        api.announcements.feed.approve, { announcementId },
      )).rejects.toThrow("Only pending announcements can be approved");
      expect((await t.run((ctx) => ctx.db.get(announcementId)))?.status).toBe(status);
      expect(await sideEffects(t)).toEqual({ deliveries: [], audits: [] });
    },
  );

  it("does not reject an active announcement", async () => {
    const { t, approverId, announcementId } = await fixture();
    await t.run((ctx) => ctx.db.patch(announcementId, { status: "ACTIVE" }));

    await expect(t.withIdentity({ subject: approverId }).mutation(
      api.announcements.feed.reject, { announcementId, note: "Too late" },
    )).rejects.toThrow("Only pending announcements can be rejected");
    const announcement = await t.run((ctx) => ctx.db.get(announcementId));
    expect(announcement?.status).toBe("ACTIVE");
    expect(announcement?.rejectionNote).toBeUndefined();
    expect(await sideEffects(t)).toEqual({ deliveries: [], audits: [] });
  });

  it("rejects a pending announcement only once", async () => {
    const { t, approverId, announcementId } = await fixture();
    const approver = t.withIdentity({ subject: approverId });
    await approver.mutation(api.announcements.feed.reject, { announcementId, note: "Needs revision" });
    const first = await sideEffects(t);
    expect(first.audits.map((event) => event.action)).toEqual(["ANNOUNCEMENT_REJECTED"]);
    expect(first.deliveries).toHaveLength(0);

    await expect(approver.mutation(api.announcements.feed.reject, { announcementId }))
      .rejects.toThrow("Only pending announcements can be rejected");
    expect(await sideEffects(t)).toEqual(first);
    const announcement = await t.run((ctx) => ctx.db.get(announcementId));
    expect(announcement?.status).toBe("REJECTED");
    expect(announcement?.rejectionNote).toBe("Needs revision");
  });
});
