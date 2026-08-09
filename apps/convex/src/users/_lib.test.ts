import { describe, expect, test } from "vitest";
import {
  betterAuthRoleForAppRoles,
  generateTemporaryPassword,
} from "./_lib";

describe("generateTemporaryPassword", () => {
  test("defaults to Better Auth's 12-character minimum", () => {
    expect(generateTemporaryPassword()).toHaveLength(12);
  });
});

describe("betterAuthRoleForAppRoles", () => {
  test("keeps super admins distinct from ordinary admins", () => {
    expect(betterAuthRoleForAppRoles(["SUPER_ADMIN"])).toBe("super_admin");
    expect(betterAuthRoleForAppRoles(["ADMIN"])).toBe("admin");
  });

  test("does not treat support staff as an admin role", () => {
    expect(betterAuthRoleForAppRoles(["SUPPORT_STAFF"])).toBe(
      "support_staff",
    );
  });
});
