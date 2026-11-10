/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

async function fixture(status: Doc<"announcements">["status"]) {
  const t = convexTest(schema, modules);
  const { adminId, announcementId } = await t.run(async (ctx) => {
    const adminId = await insertUser(ctx, { uniqueId: "ADMIN-1", firstName: "Grace", lastName: "Hopper", roles: ["ADMIN"] });
    const announcementId = await ctx.db.insert("announcements", {
      authorId: adminId,
      title: "Field trip forms",
      body: "Forms are due Friday.",
      targetType: "SCHOOL_WIDE",
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      status,
      allowComments: false,
      isAdminGeneral: false,
      commentCount: 0,
      createdAt: 1,
      updatedAt: 1,
    });
    return { adminId, announcementId };
  });
  const admin = t.withIdentity({ subject: adminId });
  const read = () => t.run((ctx) => ctx.db.get(announcementId));
  const deliveries = () =>
    t.run(async (ctx) => (await ctx.db.query("notificationDeliveries").collect()).length);
  return { admin, announcementId, read, deliveries };
}

describe("announcement approval", () => {
  test("approving twice does not publish or notify a second time", async () => {
    const { admin, announcementId, read, deliveries } = await fixture("PENDING_APPROVAL");
    await admin.mutation(api.announcements.feed.approve, { announcementId });
    const approved = await read();
    expect(approved?.status).toBe("ACTIVE");
    const delivered = await deliveries();
    expect(delivered).toBeGreaterThan(0);

    await expect(
      admin.mutation(api.announcements.feed.approve, { announcementId }),
    ).rejects.toThrow("no longer waiting for approval");
    expect((await read())?.approvedAt).toBe(approved?.approvedAt);
    expect(await deliveries()).toBe(delivered);
  });

  test.each(["ARCHIVED", "REJECTED"] as const)(
    "an %s announcement cannot be approved back to life",
    async (status) => {
      const { admin, announcementId, read } = await fixture(status);
      await expect(
        admin.mutation(api.announcements.feed.approve, { announcementId }),
      ).rejects.toThrow("no longer waiting for approval");
      expect((await read())?.status).toBe(status);
    },
  );

  test("reject does not take down a live announcement", async () => {
    const { admin, announcementId, read } = await fixture("ACTIVE");
    await expect(
      admin.mutation(api.announcements.feed.reject, { announcementId }),
    ).rejects.toThrow("no longer waiting for approval");
    expect((await read())?.status).toBe("ACTIVE");
  });
});
