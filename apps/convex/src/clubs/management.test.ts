import { describe, expect, test } from "vitest";
import type { AppRole } from "../../lib/roles";
import { canCreateClub, canPermanentlyDeleteClub } from "./management";

describe("club management authorization", () => {
  test.each<AppRole>(["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "TEACHER"])(
    "allows %s to create clubs",
    (role) => {
      expect(canCreateClub([role])).toBe(true);
    },
  );

  test.each<AppRole>(["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN", "SPONSOR"])(
    "does not allow %s to create clubs",
    (role) => {
      expect(canCreateClub([role])).toBe(false);
    },
  );
});

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
