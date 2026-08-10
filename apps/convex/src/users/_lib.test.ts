import { describe, expect, test } from "vitest";
import {
  assertCanActOn,
  assertCanResetPassword,
  assertInitialPasswordAllowed,
  betterAuthRoleForAppRoles,
  generateTemporaryPassword,
  isPrivilegeReduction,
  revokeBetterAuthSessions,
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

  test("allows support staff to reset students but no staff accounts", () => {
    expect(() =>
      assertCanResetPassword(
        { roles: ["SUPPORT_STAFF"] as never },
        { roles: ["STUDENT"] as never },
      ),
    ).not.toThrow();
    expect(() =>
      assertCanResetPassword(
        { roles: ["SUPPORT_STAFF"] as never },
        { roles: ["TEACHER"] as never },
      ),
    ).toThrow(/only reset student passwords/i);
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

describe("initial password validation", () => {
  test("rejects short and unique-ID passwords", () => {
    expect(() => assertInitialPasswordAllowed("short", "STU001")).toThrow(
      /at least 12/i,
    );
    expect(() =>
      assertInitialPasswordAllowed("STUDENT00001", "student00001"),
    ).toThrow(/cannot match/i);
  });

  test("accepts a strong unrelated temporary password", () => {
    expect(() =>
      assertInitialPasswordAllowed("RandomPass42!", "STU001"),
    ).not.toThrow();
  });
});

describe("session revocation", () => {
  test("deletes the target user's sessions through the trusted adapter", async () => {
    const calls: unknown[] = [];
    await revokeBetterAuthSessions(
      {
        runMutation: async (_reference: unknown, args: unknown) => {
          calls.push(args);
          return null;
        },
      } as never,
      "auth-user-1",
    );

    expect(calls).toEqual([
      {
        input: {
          model: "session",
          where: [{ field: "userId", value: "auth-user-1" }],
        },
        paginationOpts: { cursor: null, numItems: 1000 },
      },
    ]);
  });
});
