import { describe, expect, test } from "vitest";
import {
  assertCanActOn,
  betterAuthRoleForAppRoles,
  generateTemporaryPassword,
  isPrivilegeReduction,
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

describe("privileged account boundaries", () => {
  test("refuses actions against equal or more privileged accounts", () => {
    expect(() =>
      assertCanActOn(
        { roles: ["ADMIN"] as never },
        { roles: ["ADMIN"] as never },
      ),
    ).toThrow(/equal or greater privileges/i);
    expect(() =>
      assertCanActOn(
        { roles: ["ADMIN"] as never },
        { roles: ["SUPER_ADMIN"] as never },
      ),
    ).toThrow(/equal or greater privileges/i);
  });

  test("allows a higher privilege tier to manage a lower one", () => {
    expect(() =>
      assertCanActOn(
        { roles: ["SUPER_ADMIN"] as never },
        { roles: ["ADMIN"] as never },
      ),
    ).not.toThrow();
  });

  test("treats role removal and tier demotion as session-revoking reductions", () => {
    expect(isPrivilegeReduction(["ADMIN"], ["STUDENT"])).toBe(true);
    expect(
      isPrivilegeReduction(["STUDENT", "SPONSOR"], ["STUDENT"]),
    ).toBe(true);
    expect(isPrivilegeReduction(["STUDENT"], ["STUDENT", "SPONSOR"])).toBe(
      false,
    );
  });
});
