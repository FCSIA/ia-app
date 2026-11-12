/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { NO_CLUB_PERMISSIONS } from "../clubs/rolePermissions";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

// Deactivation also bans the Better Auth account; only the app side matters here.
vi.mock("../auth", async (importOriginal) => {
  const original = await importOriginal<typeof import("../auth")>();
  return {
    ...original,
    authComponent: {
      ...original.authComponent,
      getAuth: async () => ({ auth: { api: { banUser: async () => ({}) } }, headers: new Headers() }),
    },
  };
});
vi.mock("../users/_lib", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../users/_lib")>()),
  revokeBetterAuthSessions: async () => {},
}));

const modules = import.meta.glob("/src/**/*.*s");

async function fixture({ sponsors = 2 } = {}) {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const makeUser = (name: string, roles: Array<"STUDENT" | "TEACHER">) =>
      insertUser(ctx, { uniqueId: name, firstName: name, lastName: "Test", roles });
    const authorId = await makeUser("Author", ["STUDENT"]);
    const clubId = await ctx.db.insert("clubs", {
      name: "Robotics",
      joinPolicy: "OPEN",
      isActive: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const roleId = await ctx.db.insert("clubRoles", {
      clubId,
      name: "Organizer",
      permissions: { ...NO_CLUB_PERMISSIONS, createEvents: true },
      createdById: authorId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("clubMembers", { clubId, userId: authorId, roleId, joinedAt: 1 });
    const sponsorIds: Id<"users">[] = [];
    for (let index = 0; index < sponsors; index += 1) {
      const sponsorId = await makeUser(`Sponsor${index}`, ["TEACHER"]);
      await ctx.db.insert("clubSponsors", { clubId, userId: sponsorId, addedAt: 1 });
      sponsorIds.push(sponsorId);
    }
    const adminId = await makeUser("Admin", ["TEACHER"]);
    await ctx.db.patch(adminId, { roles: ["SUPER_ADMIN"] });
    return { adminId, authorId, clubId, sponsorIds };
  });
  const as = (userId: Id<"users">) => t.withIdentity({ subject: userId });
  const createPending = () =>
    as(ids.authorId).mutation(api.events.events.create, {
      title: "Build night",
      startAt: Date.UTC(2026, 11, 1, 18),
      clubId: ids.clubId,
    });
  const read = (eventId: Id<"events">) =>
    t.run(async (ctx) => ({
      event: await ctx.db.get(eventId),
      pendingApprovals: (
        await ctx.db
          .query("eventApprovals")
          .withIndex("by_eventId_and_status", (q) =>
            q.eq("eventId", eventId).eq("status", "PENDING"),
          )
          .collect()
      ).length,
      calendarEntries: (
        await ctx.db
          .query("calendarEntries")
          .withIndex("by_eventId", (q) => q.eq("eventId", eventId))
          .collect()
      ).length,
    }));
  const authorNotifications = () =>
    t.run((ctx) => ctx.db.query("notificationDeliveries")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", ids.authorId))
      .collect());
  return { t, as, createPending, read, authorNotifications, ...ids };
}

describe("event approval lifecycle", () => {
  test("a rejection notifies the author and prevents another sponsor publishing", async () => {
    const { as, createPending, read, sponsorIds, authorNotifications } = await fixture();
    const eventId = await createPending();
    expect((await read(eventId)).event?.isInactive).toBeUndefined();

    await as(sponsorIds[0]).mutation(api.events.approvals.rejectEvent, { eventId });
    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0, calendarEntries: 0 });
    expect(
      await as(sponsorIds[1]).query(api.events.approvals.listPendingForSponsor, {}),
    ).toEqual([]);
    await expect(
      as(sponsorIds[1]).mutation(api.events.approvals.approveEvent, { eventId }),
    ).rejects.toThrow("Approval not found");
    expect((await read(eventId)).event?.status).toBe("CANCELLED");
    await expect(
      as(sponsorIds[0]).mutation(api.events.approvals.rejectEvent, { eventId }),
    ).rejects.toThrow("Approval not found");
    expect(await authorNotifications()).toMatchObject([{
      category: "EVENT",
      title: "Event rejected",
      body: "A club sponsor rejected “Build night”.",
      href: `/events/${eventId}`,
      subject: { kind: "event", eventId },
    }]);
  });

  test("approval rows left behind by an old cancellation cannot publish the event", async () => {
    const { t, as, authorId, createPending, read, sponsorIds } = await fixture();
    const eventId = await createPending();
    // Rows written before cancellation cleared pending approvals.
    await t.run((ctx) => ctx.db.patch(eventId, { status: "CANCELLED" }));

    expect(
      await as(sponsorIds[1]).query(api.events.approvals.listPendingForSponsor, {}),
    ).toEqual([]);
    await expect(
      as(sponsorIds[1]).mutation(api.events.approvals.approveEvent, { eventId }),
    ).rejects.toThrow("no longer waiting for approval");
    expect(await read(eventId)).toMatchObject({ calendarEntries: 0 });
    expect((await read(eventId)).event?.status).toBe("CANCELLED");

    // Cancelling again clears the leftover requests.
    await as(authorId).mutation(api.events.events.cancel, { eventId });
    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0 });
  });

  test("cancelling a pending event clears the sponsors' approval requests", async () => {
    const { t, as, authorId, createPending, read, sponsorIds } = await fixture();
    const eventId = await createPending();
    await as(authorId).mutation(api.events.events.cancel, { eventId });

    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0, calendarEntries: 0 });
    await expect(
      as(sponsorIds[0]).mutation(api.events.approvals.approveEvent, { eventId }),
    ).rejects.toThrow("Approval not found");
    // Cancelling again is a no-op rather than another transition.
    const writes = () =>
      t.run(async (ctx) => ({
        updatedAt: (await ctx.db.get(eventId))?.updatedAt,
        audits: (await ctx.db.query("auditEvents").collect()).length,
      }));
    const before = await writes();
    await as(authorId).mutation(api.events.events.cancel, { eventId });
    expect(await writes()).toEqual(before);
  });

  test("publishes once every sponsor approves", async () => {
    const { as, createPending, read, sponsorIds } = await fixture();
    const eventId = await createPending();
    await as(sponsorIds[0]).mutation(api.events.approvals.approveEvent, { eventId });
    expect((await read(eventId)).event?.status).toBe("PENDING_APPROVAL");
    await as(sponsorIds[1]).mutation(api.events.approvals.approveEvent, { eventId });
    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0, calendarEntries: 1 });
    expect((await read(eventId)).event?.status).toBe("PUBLISHED");
  });

  test("a club with no sponsor cannot create an event that would wait forever", async () => {
    const { t, createPending } = await fixture({ sponsors: 0 });
    await expect(createPending()).rejects.toThrow("no sponsor to approve events");
    expect(await t.run((ctx) => ctx.db.query("events").collect())).toEqual([]);
  });
});

describe("event approvals when sponsors change", () => {
  const setActive = (t: Awaited<ReturnType<typeof fixture>>["t"], userId: Id<"users">, isActive: boolean) =>
    t.run((ctx) => ctx.db.patch(userId, { isActive }));
  const approvers = (t: Awaited<ReturnType<typeof fixture>>["t"], eventId: Id<"events">) =>
    t.run(async (ctx) =>
      (await ctx.db
        .query("eventApprovals")
        .withIndex("by_eventId_and_status", (q) => q.eq("eventId", eventId).eq("status", "PENDING"))
        .collect()).map((approval) => approval.sponsorId),
    );

  test("only active sponsors are asked, and a club whose sponsors are all inactive cannot wait on them", async () => {
    const { t, as, createPending, read, sponsorIds } = await fixture();
    await setActive(t, sponsorIds[1], false);
    const eventId = await createPending();
    expect(await approvers(t, eventId)).toEqual([sponsorIds[0]]);
    await as(sponsorIds[0]).mutation(api.events.approvals.approveEvent, { eventId });
    expect((await read(eventId)).event?.status).toBe("PUBLISHED");

    await setActive(t, sponsorIds[0], false);
    await expect(createPending()).rejects.toThrow("no sponsor to approve events");
  });

  test("an approval publishes the event when the only other request is from a sponsor deactivated earlier", async () => {
    const { t, as, createPending, read, sponsorIds } = await fixture();
    const eventId = await createPending();
    // Deactivated before deactivation settled approvals, so the request remains.
    await setActive(t, sponsorIds[1], false);
    await as(sponsorIds[0]).mutation(api.events.approvals.approveEvent, { eventId });
    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0, calendarEntries: 1 });
    expect((await read(eventId)).event?.status).toBe("PUBLISHED");
  });

  test("deactivating the last sponsor still to decide publishes an event the others approved", async () => {
    const { t, as, adminId, createPending, read, sponsorIds } = await fixture();
    const eventId = await createPending();
    await as(sponsorIds[0]).mutation(api.events.approvals.approveEvent, { eventId });
    await t.run((ctx) => ctx.db.patch(sponsorIds[1], { authUserId: "sponsor-1" }));
    await as(adminId).mutation(api.users.admin.deactivate, { userId: sponsorIds[1] });

    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0, calendarEntries: 1 });
    expect((await read(eventId)).event?.status).toBe("PUBLISHED");
  });

  test("an event whose approvers all left is handed to the club's other active sponsors", async () => {
    const { t, as, adminId, createPending, read, sponsorIds } = await fixture();
    await setActive(t, sponsorIds[1], false);
    const eventId = await createPending();
    // The second sponsor returns, then the only approver leaves.
    await setActive(t, sponsorIds[1], true);
    await as(adminId).mutation(api.users.admin.deleteUsers, { userIds: [sponsorIds[0]] });

    expect(await approvers(t, eventId)).toEqual([sponsorIds[1]]);
    expect(
      (await as(sponsorIds[1]).query(api.events.approvals.listPendingForSponsor, {})).map((event) => event._id),
    ).toEqual([eventId]);
    await as(sponsorIds[1]).mutation(api.events.approvals.approveEvent, { eventId });
    expect((await read(eventId)).event?.status).toBe("PUBLISHED");
  });

  test.each(["deactivate", "delete"] as const)("cancels and notifies when the last sponsor is removed by %s", async (operation) => {
    const { t, as, adminId, createPending, read, sponsorIds, authorNotifications } = await fixture({ sponsors: 1 });
    const eventId = await createPending();
    if (operation === "deactivate") {
      await t.run((ctx) => ctx.db.patch(sponsorIds[0], { authUserId: "sponsor-0" }));
      await as(adminId).mutation(api.users.admin.deactivate, { userId: sponsorIds[0] });
    } else {
      await as(adminId).mutation(api.users.admin.deleteUsers, { userIds: [sponsorIds[0]] });
    }

    expect(await read(eventId)).toMatchObject({ pendingApprovals: 0, calendarEntries: 0 });
    expect((await read(eventId)).event?.status).toBe("CANCELLED");
    expect(await authorNotifications()).toMatchObject([{
      category: "EVENT",
      title: "Event cancelled",
      body: "“Build night” was cancelled because no active club sponsor was available to approve it.",
      href: `/events/${eventId}`,
      subject: { kind: "event", eventId },
    }]);
    const audit = await t.run((ctx) => ctx.db.query("auditEvents").collect());
    expect(audit.find((row) => row.action === "EVENT_CANCELLED")).toMatchObject({
      entityId: eventId,
      meta: { reason: "NO_ACTIVE_SPONSOR", auditSource: "system" },
    });
  });
});
