import { describe, expect, test } from "vitest";
import { formatSchoolTime } from "./time-format";

describe("formatSchoolTime", () => {
  test("uses AM/PM by default", () => {
    expect(formatSchoolTime("08:05")).toBe("8:05 AM");
    expect(formatSchoolTime("12:00")).toBe("12:00 PM");
    expect(formatSchoolTime("00:30")).toBe("12:30 AM");
  });

  test("uses military time only when requested", () => {
    expect(formatSchoolTime("08:05", true)).toBe("08:05");
    expect(formatSchoolTime("13:45", true)).toBe("13:45");
  });
});
