/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import type { QueryCtx } from "../_generated/server";
import type { Id } from "../_generated/dataModel";

vi.mock("../../lib/currentUser", () => ({
  getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
  },
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
    const makeUser = (uniqueId: string) => ctx.db.insert("users", {
      uniqueId, firstName: uniqueId, lastName: "Test", roles: ["STUDENT"],
      isStudent: true, isTeacherStaff: false, isStudentAdmin: false, isOtherRole: false,
      isActive: true, mustResetPassword: false, dashboardLayout: [], searchText: uniqueId,
      createdAt: 1, updatedAt: 1,
    });
    const memberId = await makeUser("CHANNEL-MEMBER");
    const outsiderId = await makeUser("CHANNEL-OUTSIDER");
    const clubId = await ctx.db.insert("clubs", {
      name: "Robotics Club", joinPolicy: "OPEN", isActive: true, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("clubMembers", { clubId, userId: memberId, role: "MEMBER", joinedAt: 1 });
    const publicChannelId = await ctx.db.insert("clubChannels", {
      clubId, name: "builds", description: "Build talk.", visibility: "PUBLIC",
      createdById: memberId, createdAt: 1, updatedAt: 1,
    });
    const privateChannelId = await ctx.db.insert("clubChannels", {
      clubId, name: "leaders", visibility: "PRIVATE",
      createdById: memberId, createdAt: 1, updatedAt: 1,
    });
    const inactiveClubId = await ctx.db.insert("clubs", {
      name: "Dormant Club", joinPolicy: "OPEN", isActive: false, createdAt: 1, updatedAt: 1,
    });
    await ctx.db.insert("clubMembers", { clubId: inactiveClubId, userId: memberId, role: "MEMBER", joinedAt: 1 });
    const dormantChannelId = await ctx.db.insert("clubChannels", {
      clubId: inactiveClubId, name: "general", visibility: "PUBLIC",
      createdById: memberId, createdAt: 1, updatedAt: 1,
    });
    return { memberId, outsiderId, clubId, publicChannelId, privateChannelId, dormantChannelId };
  });
  return { t, ...ids };
}

describe("channels.getById", () => {
  test("returns a readable channel and its club, and nothing to people outside the club", async () => {
    const { t, memberId, outsiderId, publicChannelId } = await fixture();
    const member = t.withIdentity({ subject: memberId });
    expect(await member.query(api.clubs.channels.getById, { channelId: publicChannelId })).toEqual({
      club: { _id: expect.anything(), name: "Robotics Club" },
      channel: {
        _id: publicChannelId,
        name: "builds",
        description: "Build talk.",
        visibility: "PUBLIC",
      },
    });
    expect(await t.query(api.clubs.channels.getById, { channelId: publicChannelId })).toBeNull();
    expect(
      await t.withIdentity({ subject: outsiderId }).query(api.clubs.channels.getById, { channelId: publicChannelId }),
    ).toBeNull();
  });

  test("hides a private channel unless the person is in it", async () => {
    const { t, memberId, privateChannelId } = await fixture();
    const member = t.withIdentity({ subject: memberId });
    expect(await member.query(api.clubs.channels.getById, { channelId: privateChannelId })).toBeNull();
    await t.run((ctx) =>
      ctx.db.insert("clubChannelMemberships", { channelId: privateChannelId, userId: memberId, createdAt: 1 }),
    );
    expect(await member.query(api.clubs.channels.getById, { channelId: privateChannelId })).toMatchObject({
      channel: { _id: privateChannelId, name: "leaders", visibility: "PRIVATE" },
    });
  });

  test("hides channels of a deactivated club", async () => {
    const { t, memberId, dormantChannelId } = await fixture();
    expect(
      await t.withIdentity({ subject: memberId }).query(api.clubs.channels.getById, { channelId: dormantChannelId }),
    ).toBeNull();
  });
});
