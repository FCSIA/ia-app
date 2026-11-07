import { describe, expect, test } from "vitest";
import {
  ANNOUNCEMENT_AUTHOR_ROLES,
  ANNOUNCEMENT_REVIEWER_ROLES,
  EVENT_CANCEL_ANY_ROLES,
  EVENT_CANCEL_ANY_WEB_ROLES,
  EVENT_GENERAL_CREATOR_ROLES,
  EVENT_MANAGER_ROLES,
  FLEX_ATTENDANCE_MANAGER_ROLES,
  FLEX_ATTENDANCE_ROLES,
  FLEX_MANAGER_ROLES,
  FLEX_SESSION_CREATOR_ROLES,
  MODERATION_ALERT_ROLES,
  MODERATION_READER_ROLES,
  STUDENT_GROUP_ROLES,
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
  });

  test("accepts a user, a role list, or nothing", () => {
    expect(isStaff({ roles: ["SUPPORT_STAFF"] })).toBe(true);
    expect(isStaff(["TEACHER"])).toBe(false);
    expect(isStaff(null)).toBe(false);
    expect(isStaff({ roles: undefined })).toBe(false);
  });
});

describe("sets that intentionally differ", () => {
  test.each([
    [EVENT_MANAGER_ROLES, "STUDENT_ADMIN", true],
    [EVENT_GENERAL_CREATOR_ROLES, "STUDENT_ADMIN", false],
    [EVENT_CANCEL_ANY_ROLES, "SUPPORT_STAFF", true],
    [EVENT_CANCEL_ANY_WEB_ROLES, "SUPPORT_STAFF", false],
    [ANNOUNCEMENT_AUTHOR_ROLES, "STUDENT_ADMIN", true],
    [ANNOUNCEMENT_REVIEWER_ROLES, "STUDENT_ADMIN", false],
    [MODERATION_READER_ROLES, "SUPPORT_STAFF", true],
    [MODERATION_ALERT_ROLES, "SUPPORT_STAFF", false],
    [FLEX_SESSION_CREATOR_ROLES, "STUDENT_ADMIN", true],
    [FLEX_MANAGER_ROLES, "STUDENT_ADMIN", false],
    [FLEX_ATTENDANCE_MANAGER_ROLES, "TEACHER", false],
    [FLEX_ATTENDANCE_ROLES, "TEACHER", true],
  ] as const)("%j includes %s: %s", (set, role, expected) => {
    expect(hasAnyRole([role], set)).toBe(expected);
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
