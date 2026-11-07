import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import { roleRemovalChannelAccessUpdate } from "./management";

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
