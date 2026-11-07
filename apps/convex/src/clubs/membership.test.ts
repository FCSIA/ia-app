import { describe, expect, test } from "vitest";
import type { Doc, Id } from "../_generated/dataModel";
import {
  hasElevatedChannelAccess,
  isDirectoryLeader,
  isLeadersMentionTarget,
  memberRoleId,
} from "./membership";
import { LEADER_CLUB_PERMISSIONS, NO_CLUB_PERMISSIONS } from "./rolePermissions";

const roleId = "role" as Id<"clubRoles">;
const legacyRoleId = "legacy" as Id<"clubRoles">;
const roleWith = (permissions: Doc<"clubRoles">["permissions"]) =>
  ({ _id: roleId, permissions }) as Doc<"clubRoles">;

describe("club member roles", () => {
  test("reads the role from either field, current first", () => {
    expect(memberRoleId({ roleId, customRoleId: legacyRoleId })).toBe(roleId);
    expect(memberRoleId({ customRoleId: legacyRoleId })).toBe(legacyRoleId);
    expect(memberRoleId({})).toBeUndefined();
  });

  test("the three leader definitions stay distinct", () => {
    const viewOnly = roleWith({ ...NO_CLUB_PERMISSIONS, viewPrivateChannels: true });
    const pinOnly = roleWith({ ...NO_CLUB_PERMISSIONS, pinMessages: true });

    // `@leaders`: any role with a permission, else legacy LEADER rows without a role.
    expect(isLeadersMentionTarget({ roleId, role: "MEMBER" }, new Set([roleId]))).toBe(true);
    expect(isLeadersMentionTarget({ roleId, role: "LEADER" }, new Set())).toBe(false);
    expect(isLeadersMentionTarget({ role: "LEADER" }, new Set())).toBe(true);

    // Directory: a resolved role decides, otherwise legacy LEADER.
    expect(isDirectoryLeader({ role: "MEMBER" }, pinOnly)).toBe(true);
    expect(isDirectoryLeader({ role: "LEADER" }, roleWith(NO_CLUB_PERMISSIONS))).toBe(false);
    expect(isDirectoryLeader({ role: "LEADER" }, null)).toBe(true);

    // Channel audiences: channel permissions, or a legacy LEADER or SPONSOR row.
    expect(hasElevatedChannelAccess({ role: "MEMBER" }, pinOnly)).toBe(false);
    expect(hasElevatedChannelAccess({ role: "MEMBER" }, viewOnly)).toBe(true);
    expect(hasElevatedChannelAccess({ role: "SPONSOR" }, undefined)).toBe(true);
    expect(hasElevatedChannelAccess({ role: "MEMBER" }, roleWith(LEADER_CLUB_PERMISSIONS))).toBe(true);
  });
});
