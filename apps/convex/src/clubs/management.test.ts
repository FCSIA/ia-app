import { describe, expect, test } from "vitest";
import type { AppRole } from "../../../shared/roles";
import type { Id } from "../_generated/dataModel";
import {
  canPermanentlyDeleteClub,
  roleRemovalChannelAccessUpdate,
} from "./management";

describe("permanent club deletion authorization", () => {
  test("allows superadmins", () => {
    expect(canPermanentlyDeleteClub(["SUPER_ADMIN"])).toBe(true);
  });

  test.each<AppRole>([
    "ADMIN",
    "SUPPORT_STAFF",
    "TEACHER",
    "SPONSOR",
    "STUDENT_ADMIN",
    "STUDENT_LEADER",
    "STUDENT",
  ])("does not allow %s", (role) => {
    expect(canPermanentlyDeleteClub([role])).toBe(false);
  });
});

describe("role removal channel access updates", () => {
  const removedRoleId = "role-removed" as Id<"clubRoles">;
  const retainedRoleId = "role-retained" as Id<"clubRoles">;

  test("keeps a channel private when another role still restricts it", () => {
    expect(
      roleRemovalChannelAccessUpdate(
        {
          accessRoleIds: [removedRoleId, retainedRoleId],
          accessUnitId: undefined,
          postingPolicy: "AUDIENCE",
          visibility: "PRIVATE",
        },
        removedRoleId,
      ),
    ).toEqual({
      accessRoleIds: [retainedRoleId],
      broadensAccess: false,
      visibility: "PRIVATE",
    });
  });

  test("marks a channel club-wide when the deleted role was its only filter", () => {
    expect(
      roleRemovalChannelAccessUpdate(
        {
          accessRoleIds: [removedRoleId],
          accessUnitId: undefined,
          postingPolicy: "AUDIENCE",
          visibility: "PRIVATE",
        },
        removedRoleId,
      ),
    ).toEqual({
      accessRoleIds: [],
      broadensAccess: true,
      visibility: "PUBLIC",
    });
  });

  test("keeps a read-only channel read-only when its final role filter is removed", () => {
    expect(
      roleRemovalChannelAccessUpdate(
        {
          accessRoleIds: [removedRoleId],
          accessUnitId: undefined,
          postingPolicy: "CLUB_MANAGERS",
          visibility: "PRIVATE",
        },
        removedRoleId,
      ),
    ).toEqual({
      accessRoleIds: [],
      broadensAccess: true,
      visibility: "MEMBER_READONLY",
    });
  });
});
