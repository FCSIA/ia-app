/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import schema from "../schema";
import type { ClubContext } from "./access";
import {
  getChannelAccess,
  getChannelAccessForChannels,
  getChannelAudienceUserIds,
} from "./channelAccess";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

const modules = import.meta.glob("../**/*.*s");

function memberContext(clubId: Id<"clubs">): ClubContext {
  return {
    club: { _id: clubId } as Doc<"clubs">,
    membership: null,
    role: null,
    permissions: NO_CLUB_PERMISSIONS,
    isMember: true,
    hasClubRole: false,
    isSponsor: false,
    isAdmin: false,
    canAccessWorkspace: true,
    canManageChannels: false,
    canManageMembership: false,
    canApproveJoinRequests: false,
    canSeePrivateChannels: false,
    hasPendingJoinRequest: false,
  };
}

describe("channel role and structure filters", () => {
  test("parent assignments inherit downward without parent or sibling leakage", async () => {
    const t = convexTest(schema, modules);
    const result = await t.run(async (ctx) => {
      const now = 1;
      const creatorId = await ctx.db.insert("users", {
        uniqueId: "CREATOR",
        firstName: "Channel",
        lastName: "Creator",
        roles: ["STUDENT"],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: "Channel Creator CREATOR",
        createdAt: now,
        updatedAt: now,
      });
      const clubId = await ctx.db.insert("clubs", {
        name: "Filter Club",
        joinPolicy: "OPEN",
        isActive: true,
        createdAt: now,
        updatedAt: now,
      });
      const makeUnit = (name: string, parentUnitId?: Id<"clubUnits">) =>
        ctx.db.insert("clubUnits", {
          clubId,
          parentUnitId,
          name,
          joinPolicy: "ASSIGN_ONLY" as const,
          position: 0,
          isActive: true,
          createdById: creatorId,
          createdAt: now,
          updatedAt: now,
        });
      const schoolId = await makeUnit("School");
      const houseAId = await makeUnit("House A", schoolId);
      const houseBId = await makeUnit("House B", schoolId);
      const roomAId = await makeUnit("Room A", houseAId);
      const roomBId = await makeUnit("Room B", houseAId);
      const allowedRoleId = await ctx.db.insert("clubRoles", {
        clubId,
        name: "Allowed role",
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: false,
        showInDirectory: false,
        position: 0,
        createdById: creatorId,
        createdAt: now,
        updatedAt: now,
      });
      const otherRoleId = await ctx.db.insert("clubRoles", {
        clubId,
        name: "Other role",
        permissions: NO_CLUB_PERMISSIONS,
        isDefault: false,
        showInDirectory: false,
        position: 1,
        createdById: creatorId,
        createdAt: now,
        updatedAt: now,
      });

      const assignments = [
        ["SCHOOL", schoolId, allowedRoleId],
        ["HOUSE-A", houseAId, allowedRoleId],
        ["HOUSE-B", houseBId, allowedRoleId],
        ["ROOM-A", roomAId, allowedRoleId],
        ["ROOM-A-WRONG-ROLE", roomAId, otherRoleId],
        ["ROOM-B", roomBId, allowedRoleId],
        ["EXPLICIT", roomBId, otherRoleId],
      ] as const;
      const userIds = new Map<string, Id<"users">>();
      for (const [uniqueId, unitId, roleId] of assignments) {
        const userId = await ctx.db.insert("users", {
          uniqueId,
          firstName: uniqueId,
          lastName: "User",
          roles: ["STUDENT"],
          isStudent: true,
          isTeacherStaff: false,
          isStudentAdmin: false,
          isOtherRole: false,
          isActive: true,
          mustResetPassword: false,
          dashboardLayout: [],
          searchText: `${uniqueId} User`,
          createdAt: now,
          updatedAt: now,
        });
        userIds.set(uniqueId, userId);
        await ctx.db.insert("clubMembers", {
          clubId,
          userId,
          roleId,
          joinedAt: now,
        });
        await ctx.db.insert("clubUnitMembers", {
          clubId,
          unitId,
          userId,
          joinedAt: now,
          updatedAt: now,
        });
      }

      const roomChannelId = await ctx.db.insert("clubChannels", {
        clubId,
        accessPolicyVersion: 2,
        accessRoleIds: [allowedRoleId],
        accessUnitId: roomAId,
        postingPolicy: "AUDIENCE",
        name: "Room A",
        visibility: "PRIVATE",
        createdById: creatorId,
        createdAt: now,
        updatedAt: now,
      });
      const houseChannelId = await ctx.db.insert("clubChannels", {
        clubId,
        accessPolicyVersion: 2,
        accessRoleIds: [],
        accessUnitId: houseAId,
        postingPolicy: "AUDIENCE",
        name: "House A",
        visibility: "PRIVATE",
        createdById: creatorId,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("clubChannelMemberships", {
        channelId: roomChannelId,
        userId: userIds.get("EXPLICIT")!,
        createdAt: now,
      });

      const roomChannel = (await ctx.db.get(roomChannelId))!;
      const houseChannel = (await ctx.db.get(houseChannelId))!;
      const context = memberContext(clubId);
      const managerContext = { ...context, canManageChannels: true };
      const access = async (channel: Doc<"clubChannels">, uniqueId: string) =>
        (await getChannelAccess(
          ctx,
          channel,
          context,
          userIds.get(uniqueId)!,
        )).canView;
      const batchedHouseA = await getChannelAccessForChannels(
        ctx,
        [roomChannel, houseChannel],
        context,
        userIds.get("HOUSE-A")!,
      );
      const batchedExplicit = await getChannelAccessForChannels(
        ctx,
        [roomChannel, houseChannel],
        context,
        userIds.get("EXPLICIT")!,
      );

      return {
        room: Object.fromEntries(
          await Promise.all(
            assignments.map(async ([uniqueId]) => [
              uniqueId,
              await access(roomChannel, uniqueId),
            ]),
          ),
        ),
        house: {
          school: await access(houseChannel, "SCHOOL"),
          houseA: await access(houseChannel, "HOUSE-A"),
          roomA: await access(houseChannel, "ROOM-A"),
          roomB: await access(houseChannel, "ROOM-B"),
          houseB: await access(houseChannel, "HOUSE-B"),
        },
        audience: await getChannelAudienceUserIds(ctx, roomChannel, 20),
        manager: await getChannelAccess(
          ctx,
          roomChannel,
          managerContext,
          creatorId,
        ),
        batchedHouseA: {
          room: batchedHouseA.get(roomChannelId)?.canView,
          house: batchedHouseA.get(houseChannelId)?.canView,
        },
        batchedExplicit: {
          room: batchedExplicit.get(roomChannelId)?.canView,
          house: batchedExplicit.get(houseChannelId)?.canView,
        },
        userIds: Object.fromEntries(userIds),
      };
    });

    expect(result.room).toEqual({
      SCHOOL: true,
      "HOUSE-A": true,
      "HOUSE-B": false,
      "ROOM-A": true,
      "ROOM-A-WRONG-ROLE": false,
      "ROOM-B": false,
      EXPLICIT: true,
    });
    expect(result.house).toEqual({
      school: true,
      houseA: true,
      roomA: false,
      roomB: false,
      houseB: false,
    });
    expect(new Set(result.audience)).toEqual(new Set([
      result.userIds.SCHOOL,
      result.userIds["HOUSE-A"],
      result.userIds["ROOM-A"],
      result.userIds.EXPLICIT,
    ]));
    expect(result.manager).toMatchObject({ canView: true, canManage: true });
    expect(result.batchedHouseA).toEqual({ room: true, house: true });
    expect(result.batchedExplicit).toEqual({ room: true, house: false });
  });
});
