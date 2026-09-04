/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import { internal } from "../_generated/api";
import schema from "../schema";

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", {
      uniqueId: "RECEIPT-TEST",
      firstName: "Receipt",
      lastName: "Test",
      roles: ["STUDENT"],
      isStudent: true,
      isTeacherStaff: false,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "Receipt Test",
      createdAt: 1,
      updatedAt: 1,
    });
    const clubId = await ctx.db.insert("clubs", {
      name: "Receipt club",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const channelId = await ctx.db.insert("clubChannels", {
      clubId,
      name: "general",
      visibility: "PUBLIC",
      createdById: userId,
      createdAt: 1,
      updatedAt: 1,
    });
    return { userId, clubId, channelId };
  });
  return { t, ...ids };
}

async function insertDelivery(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  args: Awaited<ReturnType<typeof fixture>> extends infer _T
    ? { userId: any; channelId?: any; sourceCreatedAt?: number; createdAt: number; isRead?: boolean }
    : never,
) {
  return t.run((ctx) =>
    ctx.db.insert("notificationDeliveries", {
      userId: args.userId,
      channelId: args.channelId,
      sourceCreatedAt: args.sourceCreatedAt,
      category: "CLUB_CHANNEL_MESSAGE",
      title: "Message",
      body: "Body",
      href: "/notifications",
      subject: { kind: "system" },
      isRead: args.isRead ?? false,
      createdAt: args.createdAt,
    }),
  );
}

describe("notification read reconciliation", () => {
  test("channel continuation clears only matching unread deliveries through its boundary", async () => {
    const { t, userId, clubId, channelId } = await fixture();
    await insertDelivery(t, { userId, channelId, sourceCreatedAt: 10, createdAt: 10 });
    const newer = await insertDelivery(t, { userId, channelId, sourceCreatedAt: 11, createdAt: 11 });
    const otherChannel = await insertDelivery(t, { userId, sourceCreatedAt: 9, createdAt: 9 });

    await t.mutation(internal.clubs.channels.markChannelDeliveriesReadContinuation, {
      userId,
      channelId,
      throughCreatedAt: 10,
    });

    await t.run(async (ctx) => {
      expect((await ctx.db.get(newer))?.isRead).toBe(false);
      expect((await ctx.db.get(otherChannel))?.isRead).toBe(false);
      const cleared = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_userId_and_channelId_and_isRead_and_sourceCreatedAt", (q) =>
          q.eq("userId", userId).eq("channelId", channelId).eq("isRead", true),
        )
        .take(10);
      expect(cleared).toHaveLength(1);
    });
  });

  test("inbox continuation honors its fixed cutoff across batches", async () => {
    const { t, userId } = await fixture();
    await Promise.all(
      Array.from({ length: 101 }, (_, index) =>
        insertDelivery(t, { userId, createdAt: index + 1 }),
      ),
    );
    const later = await insertDelivery(t, { userId, createdAt: 500 });

    await t.mutation(internal.notifications.inbox.acknowledgeInboxContinuation, {
      userId,
      cutoff: 101,
    });
    await t.mutation(internal.notifications.inbox.acknowledgeInboxContinuation, {
      userId,
      cutoff: 101,
    });

    await t.run(async (ctx) => {
      const unread = await ctx.db
        .query("notificationDeliveries")
        .withIndex("by_userId_and_isRead_and_createdAt", (q) =>
          q.eq("userId", userId).eq("isRead", false),
        )
        .take(10);
      expect(unread.map((row) => row._id)).toEqual([later]);
    });
  });

  test("push lookup suppresses a delivery after it is read", async () => {
    const { t, userId } = await fixture();
    const deliveryId = await insertDelivery(t, { userId, createdAt: 1 });
    await t.run((ctx) => ctx.db.patch(deliveryId, { isRead: true }));
    await expect(
      t.query(internal.notifications.delivery.getUnreadDeliveryForPush, { deliveryId }),
    ).resolves.toBeNull();
  });

  test("push lookup also honors a receipt before batch reconciliation completes", async () => {
    const { t, userId, clubId, channelId } = await fixture();
    const deliveryId = await insertDelivery(t, {
      userId,
      channelId,
      sourceCreatedAt: 10,
      createdAt: 10,
    });
    await t.run((ctx) =>
      ctx.db.insert("clubChannelReadReceipts", {
        clubId,
        channelId,
        userId,
        lastReadAt: 10,
      }),
    );
    await expect(
      t.query(internal.notifications.delivery.getUnreadDeliveryForPush, {
        deliveryId,
      }),
    ).resolves.toBeNull();
  });
});
