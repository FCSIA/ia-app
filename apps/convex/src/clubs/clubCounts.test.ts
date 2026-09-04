/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import type { Id } from "../_generated/dataModel";
import schema from "../schema";
import { adjustClubCounts, recountClub } from "./counts";
import { clubSummaryWithCounts } from "./serialize";

const modules = import.meta.glob("../**/*.*s");

type SeedOptions = {
  members: number;
  channels: number;
  memberCount?: number;
  channelCount?: number;
};

async function seed(t: ReturnType<typeof convexTest>, options: SeedOptions) {
  return t.run(async (ctx) => {
    const clubId = await ctx.db.insert("clubs", {
      name: "Robotics",
      joinPolicy: "OPEN",
      isActive: true,
      memberCount: options.memberCount,
      channelCount: options.channelCount,
      createdAt: 0,
      updatedAt: 0,
    });

    const creatorId = await ctx.db.insert("users", {
      uniqueId: "creator-1",
      firstName: "Grace",
      lastName: "Hopper",
      roles: ["TEACHER"],
      isStudent: false,
      isTeacherStaff: true,
      isStudentAdmin: false,
      isOtherRole: false,
      isActive: true,
      mustResetPassword: false,
      dashboardLayout: [],
      searchText: "grace hopper",
      createdAt: 0,
      updatedAt: 0,
    });

    for (let index = 0; index < options.members; index += 1) {
      const userId = await ctx.db.insert("users", {
        uniqueId: `member-${index}`,
        firstName: "Member",
        lastName: String(index),
        roles: ["STUDENT"],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: `member ${index}`,
        createdAt: 0,
        updatedAt: 0,
      });
      await ctx.db.insert("clubMembers", { clubId, userId, joinedAt: index });
    }

    for (let index = 0; index < options.channels; index += 1) {
      await ctx.db.insert("clubChannels", {
        clubId,
        name: `channel-${index}`,
        visibility: "PUBLIC",
        createdById: creatorId,
        createdAt: index,
        updatedAt: index,
      });
    }

    return { clubId, creatorId };
  });
}

async function summaryCounts(
  t: ReturnType<typeof convexTest>,
  clubId: Id<"clubs">,
  overrides?: { members?: number; channels?: number },
) {
  return t.run(async (ctx) => {
    const club = await ctx.db.get(clubId);
    const summary = await clubSummaryWithCounts(ctx, club!, null, overrides);
    return summary._count;
  });
}

describe("club member and channel counters", () => {
  it("counts the rows for clubs written before the counters existed", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 4, channels: 2 });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 4, channels: 2 });
  });

  it("still lets a caller that already holds the rows pass its own totals", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 4, channels: 2, memberCount: 4, channelCount: 2 });

    // The club detail query counts only the channels the viewer can see.
    expect(await summaryCounts(t, clubId, { channels: 1 })).toEqual({
      members: 4,
      channels: 1,
    });
  });

  it("adopts the true totals the first time a legacy club is adjusted", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 3, channels: 1 });

    await t.run(async (ctx) => {
      await adjustClubCounts(ctx, clubId, { members: 1, channels: 1 });
    });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 4, channels: 2 });
  });

  it("tracks joins, departures, and channel churn once the counters are set", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 5, channels: 3, memberCount: 5, channelCount: 3 });

    await t.run(async (ctx) => {
      await adjustClubCounts(ctx, clubId, { members: -2 });
      await adjustClubCounts(ctx, clubId, { channels: 4 });
    });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 3, channels: 7 });
  });

  it("leaves the club untouched when both deltas are zero", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 2, channels: 0, memberCount: 2, channelCount: 0 });

    const before = await t.run(async (ctx) => (await ctx.db.get(clubId))!.updatedAt);
    await t.run(async (ctx) => {
      await adjustClubCounts(ctx, clubId, { members: 0, channels: 0 });
    });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 2, channels: 0 });
    expect(await t.run(async (ctx) => (await ctx.db.get(clubId))!.updatedAt)).toBe(before);
  });

  it("never reports a negative count", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 0, channels: 0, memberCount: 0, channelCount: 0 });

    await t.run(async (ctx) => {
      await adjustClubCounts(ctx, clubId, { members: -1, channels: -1 });
    });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 0, channels: 0 });
  });

  it("does not double-count when a legacy club gains rows in bulk", async () => {
    // The bulk writers take one delta for the whole run. Taking it after the
    // inserts would make the one-time fallback count include the new rows and
    // then add them a second time.
    const t = convexTest(schema, modules);
    const { clubId, creatorId } = await seed(t, { members: 0, channels: 2 });

    await t.run(async (ctx) => {
      await adjustClubCounts(ctx, clubId, { channels: 3 });
      for (let index = 0; index < 3; index += 1) {
        await ctx.db.insert("clubChannels", {
          clubId,
          name: `bulk-${index}`,
          visibility: "PRIVATE",
          createdById: creatorId,
          createdAt: index,
          updatedAt: index,
        });
      }
    });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 0, channels: 5 });
  });

  it("recomputes both counters from the rows", async () => {
    const t = convexTest(schema, modules);
    const { clubId } = await seed(t, { members: 6, channels: 2, memberCount: 99, channelCount: 99 });

    await t.run(async (ctx) => {
      await recountClub(ctx, clubId);
    });

    expect(await summaryCounts(t, clubId)).toEqual({ members: 6, channels: 2 });
  });
});
