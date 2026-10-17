/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import rateLimiter from "@convex-dev/rate-limiter/test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { resolveNotificationPreference } from "./deliveryPreference";
import { preferenceDeliveryDecision } from "./delivery";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  const getUser = async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  };
  return {
    ...original,
    getMaybeCurrentAppUser: getUser,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const user = await getUser(ctx);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const userId = await t.run((ctx) => ctx.db.insert("users", {
    uniqueId: "FEEDBACK-CATEGORY", firstName: "Test", lastName: "Reviewer",
    roles: ["SUPER_ADMIN"], isStudent: false, isTeacherStaff: true,
    isStudentAdmin: false, isOtherRole: false, isActive: true,
    mustResetPassword: false, dashboardLayout: [], searchText: "test reviewer",
    createdAt: 1, updatedAt: 1,
  }));
  return { t, userId, viewer: t.withIdentity({ subject: userId }) };
}

describe("feedback notification categories", () => {
  test("new feedback submissions, staff replies, and resolutions use the feedback category", async () => {
    const { t, viewer, userId } = await fixture();
    const reportId = await viewer.mutation(api.moderation.reports.submit, {
      contentType: "GENERAL", contentId: "report-page", reason: "A synthetic feature request",
    });
    await viewer.mutation(api.moderation.reports.addFeedbackResponse, { reportId, body: "We are reviewing this." });
    await viewer.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    const rows = await t.run((ctx) => ctx.db.query("notificationDeliveries").withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId)).collect());
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.category === "FEEDBACK")).toBe(true);
  });

  test("both inbox APIs normalize legacy feedback by source type, without changing stored rows or true moderation", async () => {
    const { t, viewer, userId } = await fixture();
    await t.run(async (ctx) => {
      for (const contentType of ["GENERAL", "ANNOUNCEMENT"]) {
        const reportId = await ctx.db.insert("moderationReports", {
          submitterId: userId, contentType, contentId: "synthetic", reason: "Synthetic",
          status: "PENDING", isEscalated: false, createdAt: 1,
        });
        await ctx.db.insert("notificationDeliveries", {
          userId, category: "CONTENT_MODERATED", title: "Same deliberately unhelpful title",
          body: "Same text", href: "/notifications", subject: { kind: "moderationReport", reportId },
          isRead: false, createdAt: contentType === "GENERAL" ? 2 : 1,
        });
      }
      await ctx.db.insert("notificationDeliveries", {
        userId, category: "CONTENT_MODERATED", title: "Feedback submitted", body: "Not a feedback source",
        href: "/report", subject: { kind: "system" }, isRead: false, createdAt: 0,
      });
    });
    const list = await viewer.query(api.notifications.inbox.list, {});
    const page = await viewer.query(api.notifications.inbox.listPage, { paginationOpts: { numItems: 10, cursor: null } });
    expect(list.map((row) => row.category)).toEqual(["FEEDBACK", "CONTENT_MODERATED", "CONTENT_MODERATED"]);
    expect(page.page).toEqual(list);
    expect((await t.run((ctx) => ctx.db.query("notificationDeliveries").collect())).every((row) => row.category === "CONTENT_MODERATED")).toBe(true);
    expect(await t.query(api.notifications.inbox.list, {})).toEqual([]);
  });

  test("preserves old moderation opt-outs through feedback delivery, settings reads, and push activation", async () => {
    const { t, viewer, userId } = await fixture();
    await viewer.mutation(api.notifications.preferences.upsert, { category: "CONTENT_MODERATED", enabled: false });
    const inherited = await t.run((ctx) => resolveNotificationPreference(ctx, { userId, category: "FEEDBACK", scopeKey: "global" }));
    expect(preferenceDeliveryDecision("FEEDBACK", inherited)).toEqual({ create: false, push: false });
    expect(await viewer.query(api.notifications.preferences.list, {})).toContainEqual(expect.objectContaining({ category: "FEEDBACK", enabled: false, level: "OFF" }));
    await viewer.mutation(api.notifications.preferences.activatePush, {});
    const stored = await t.run((ctx) => ctx.db.query("notificationPreferences").withIndex("by_userId_and_category_and_scopeKey", (q) => q.eq("userId", userId).eq("category", "FEEDBACK")).collect());
    expect(stored).toHaveLength(0);
    await viewer.mutation(api.notifications.preferences.upsert, { category: "FEEDBACK", enabled: true, level: "IN_APP" });
    const explicit = await t.run((ctx) => resolveNotificationPreference(ctx, { userId, category: "FEEDBACK", scopeKey: "global" }));
    expect(preferenceDeliveryDecision("FEEDBACK", explicit)).toEqual({ create: true, push: false });
    expect(await viewer.query(api.notifications.preferences.list, {})).toContainEqual(expect.objectContaining({ category: "CONTENT_MODERATED", enabled: false }));
  });
});
