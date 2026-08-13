import { describe, expect, it } from "vitest";
import {
  canAssignFlexStudents,
  canCreateFlexFriday,
  canCreateFlexSession,
  canManageExistingFlexSessions,
  canManageFlexAttendance,
} from "./permissions";

describe("Flex Friday student-admin permissions", () => {
  const studentAdmin = ["STUDENT_ADMIN"];
  const student = ["STUDENT"];

  it("allows student admins to create Flex dates and sessions", () => {
    expect(canCreateFlexFriday(studentAdmin)).toBe(true);
    expect(canCreateFlexSession(studentAdmin)).toBe(true);
    expect(canCreateFlexFriday(student)).toBe(false);
    expect(canCreateFlexSession(student)).toBe(false);
  });

  it("allows student admins to assign students and manage attendance", () => {
    expect(canAssignFlexStudents(studentAdmin)).toBe(true);
    expect(canManageFlexAttendance(studentAdmin)).toBe(true);
    expect(canAssignFlexStudents(student)).toBe(false);
    expect(canManageFlexAttendance(student)).toBe(false);
  });

  it("does not grant student admins session edit or delete access", () => {
    expect(canManageExistingFlexSessions(studentAdmin)).toBe(false);
  });
});
