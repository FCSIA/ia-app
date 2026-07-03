import { describe, expect, test } from "vitest";
import type { AppRole } from "../../lib/roles";
import { canCreateClub } from "./management";

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
