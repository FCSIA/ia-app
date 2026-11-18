/// <reference types="vite/client" />

import rateLimiter from "@convex-dev/rate-limiter/test";
import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  async function getMaybeCurrentAppUser(ctx: QueryCtx) {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  }
  return {
    ...original,
    getMaybeCurrentAppUser,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const user = await getMaybeCurrentAppUser(ctx);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  const ids = await t.run(async (ctx) => {
    const student = (uniqueId: string, gradeLevel: number, major?: "ENGINEERING" | "HEALTH_SCIENCE") =>
      ctx.db.insert("users", {
        uniqueId, firstName: uniqueId, lastName: "Test", roles: ["STUDENT"],
        gradeLevel, major, minor: "INFORMATION_TECHNOLOGY",
        isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
        isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId,
        createdAt: 1, updatedAt: 1,
      });
    const ninth = await student("NINTH", 9, "ENGINEERING");
    const tenth = await student("TENTH", 10, "ENGINEERING");
    const sponsor = await student("SPONSOR", 12);
    const clubId = await ctx.db.insert("clubs", {
      name: "Grade 10 government", joinPolicy: "OPEN", isActive: true,
      joinCode: "TESTCODE", joinCodeExpiresAt: Date.now() + 60_000,
      createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("clubSponsors", { clubId, userId: sponsor, addedAt: 1 });
    return { ninth, tenth, sponsor, clubId };
  });
  return {
    t, ...ids,
    student: t.withIdentity({ subject: ids.ninth }),
    eligible: t.withIdentity({ subject: ids.tenth }),
    manager: t.withIdentity({ subject: ids.sponsor }),
  };
}

test("only managers can change rules; open join and codes enforce all configured fields", async () => {
  const { student, eligible, manager, clubId } = await fixture();
  const joinRules = { gradeLevel: 10, major: "ENGINEERING", minor: "HEALTH_SCIENCE" } as const;
  await expect(student.mutation(api.clubs.management.update, { clubId, joinRules })).rejects.toThrow("Not a club member");
  await manager.mutation(api.clubs.management.update, { clubId, joinRules });
  const details = await student.query(api.clubs.detail.get, { clubId });
  expect(details?.joinBlockedReason).toMatch(/grade 10.*minor in Health Science/);
  await expect(student.mutation(api.clubs.invitations.joinOpenClub, { clubId })).rejects.toThrow("grade 10");
  await expect(eligible.mutation(api.clubs.invitations.redeemJoinCode, { clubId, code: "TESTCODE" })).rejects.toThrow("minor in Health Science");

  await manager.mutation(api.clubs.management.update, { clubId, joinRules: { gradeLevel: 10, major: "ENGINEERING" } });
  await expect(eligible.mutation(api.clubs.invitations.joinOpenClub, { clubId })).resolves.toEqual({ kind: "added" });
  await manager.mutation(api.clubs.management.update, { clubId, joinRules: null });
  await expect(student.mutation(api.clubs.invitations.joinOpenClub, { clubId })).resolves.toEqual({ kind: "added" });
});

test("requests, approvals, invitations, and direct enrollment honor the current rule", async () => {
  const { t, ninth, sponsor, student, manager, clubId } = await fixture();
  const { inviteId, requestId } = await t.run(async (ctx) => {
    await ctx.db.patch(clubId, { joinPolicy: "REQUEST", joinRules: { gradeLevel: 10 } });
    const requestId = await ctx.db.insert("clubJoinRequests", {
      clubId, requesterId: ninth, status: "PENDING", createdAt: 1, updatedAt: 1,
    });
    const inviteId = await ctx.db.insert("clubInvites", {
      clubId, senderId: sponsor, recipientId: ninth, status: "PENDING", createdAt: 1, updatedAt: 1,
    });
    return { inviteId, requestId };
  });
  await expect(student.mutation(api.clubs.invitations.requestToJoin, { clubId })).rejects.toThrow("grade 10");
  await expect(manager.mutation(api.clubs.invitations.respondToJoinRequest, { clubId, requestId, accept: true })).rejects.toThrow("grade 10");
  await expect(student.mutation(api.clubs.invitations.respondToInvite, { inviteId, accept: true })).rejects.toThrow("grade 10");
  await expect(manager.mutation(api.clubs.invitations.addMemberDirectly, { clubId, recipientUniqueId: "NINTH" })).rejects.toThrow("grade 10");
  await expect(t.mutation(internal.clubs.invitations.addBulkMemberByUniqueId, { clubId, uniqueId: "NINTH" })).resolves.toMatchObject({ kind: "skipped" });
  await t.run(async (ctx) => {
    expect((await ctx.db.get(requestId))?.status).toBe("PENDING");
    expect((await ctx.db.get(inviteId))?.status).toBe("PENDING");
  });
});

test("new rules preserve existing memberships and block a new unit self-join", async () => {
  const { t, ninth, sponsor, student, manager, clubId } = await fixture();
  await student.mutation(api.clubs.invitations.joinOpenClub, { clubId });
  await expect(student.mutation(api.clubs.management.update, { clubId, joinRules: { gradeLevel: 10 } })).rejects.toThrow("Not authorized");
  await manager.mutation(api.clubs.management.update, { clubId, joinRules: { gradeLevel: 10 } });
  const unitId = await t.run((ctx) => ctx.db.insert("clubUnits", {
    clubId, name: "Group", joinPolicy: "OPEN", position: 0, isActive: true,
    createdById: sponsor, createdAt: 1, updatedAt: 1,
  }));
  expect((await student.query(api.clubs.detail.get, { clubId }))?.viewer.isMember).toBe(true);
  await expect(student.mutation(api.clubs.hierarchy.join, { clubId, unitId })).rejects.toThrow("grade 10");
  await expect(t.mutation(internal.clubs.invitations.addBulkMemberByUniqueId, { clubId, uniqueId: "NINTH" })).resolves.toEqual({ kind: "alreadyMember" });
  await t.run(async (ctx) => {
    const members = await ctx.db.query("clubMembers").withIndex("by_clubId", (q) => q.eq("clubId", clubId)).collect();
    expect(members.map((member) => member.userId)).toEqual([ninth]);
  });
});
