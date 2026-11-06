import { describe, expect, test } from "vitest";
import {
  STUDENT_GROUP_ROLES,
  STUDENT_ROLES,
  canGrantRole,
  canManageUser,
  canResetUserPassword,
  hasAnyRole,
  isStaff,
  isStudent,
} from "./roles";

describe("role sets", () => {
  test("student accounts include student admins; the stored student group does not", () => {
    expect(isStudent(["STUDENT_ADMIN"])).toBe(true);
    expect(hasAnyRole(["STUDENT_ADMIN"], STUDENT_GROUP_ROLES)).toBe(false);
    expect(STUDENT_ROLES).toEqual([...STUDENT_GROUP_ROLES, "STUDENT_ADMIN"]);
  });

  test("accepts a user, a role list, or nothing", () => {
    expect(isStaff({ roles: ["SUPPORT_STAFF"] })).toBe(true);
    expect(isStaff(["TEACHER"])).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff({ roles: undefined })).toBe(false);
  });
});

describe("user management", () => {
  test("admins manage ordinary accounts; privileged accounts need a super admin", () => {
    expect(canManageUser(["ADMIN"], ["STUDENT"])).toBe(true);
    expect(canManageUser(["ADMIN"], ["ADMIN"])).toBe(false);
    expect(canManageUser(["SUPER_ADMIN"], ["ADMIN"])).toBe(true);
    expect(canManageUser(["SUPPORT_STAFF"], ["STUDENT"])).toBe(false);
  });

  test("support staff may reset student passwords only", () => {
    expect(canResetUserPassword(["SUPPORT_STAFF"], ["STUDENT_ADMIN"])).toBe(true);
    expect(canResetUserPassword(["SUPPORT_STAFF"], ["TEACHER"])).toBe(false);
  });

  test("only a super admin grants admin roles", () => {
    expect(canGrantRole(false, "ADMIN")).toBe(false);
    expect(canGrantRole(false, "SUPER_ADMIN")).toBe(false);
    expect(canGrantRole(false, "TEACHER")).toBe(true);
    expect(canGrantRole(true, "SUPER_ADMIN")).toBe(true);
  });
});
