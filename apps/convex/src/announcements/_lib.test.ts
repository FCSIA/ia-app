import { describe, expect, it } from "vitest";
import { canPostGlobalAnnouncements } from "./_lib";

describe("global announcement authoring", () => {
  it.each(["ADMIN", "SUPER_ADMIN", "TEACHER", "STUDENT_ADMIN"]) (
    "allows %s to post",
    (role) => {
      expect(canPostGlobalAnnouncements([role])).toBe(true);
    },
  );

  it.each(["STUDENT", "STUDENT_LEADER", "SPONSOR", "SUPPORT_STAFF"]) (
    "does not allow %s to post globally",
    (role) => {
      expect(canPostGlobalAnnouncements([role])).toBe(false);
    },
  );
});
