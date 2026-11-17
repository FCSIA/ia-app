import { describe, expect, test } from "vitest";
import { dailyMessageActivity } from "./_lib";

describe("Wrapped observed daily activity", () => {
  test("groups by Eastern date across midnight and orders actual days", () => {
    expect(dailyMessageActivity([
      Date.parse("2026-03-09T04:00:00Z"),
      Date.parse("2026-03-08T04:59:59Z"),
      Date.parse("2026-03-08T05:00:00Z"),
      Date.parse("2026-03-08T07:00:00Z"),
    ])).toEqual([
      { date: "2026-03-07", messages: 1 },
      { date: "2026-03-08", messages: 2 },
      { date: "2026-03-09", messages: 1 },
    ]);
  });
  test("retains sparse activity without inventing intervening days", () => {
    expect(dailyMessageActivity([Date.parse("2026-01-01T12:00:00Z"), Date.parse("2026-01-20T12:00:00Z")]))
      .toEqual([{ date: "2026-01-01", messages: 1 }, { date: "2026-01-20", messages: 1 }]);
    expect(dailyMessageActivity([])).toEqual([]);
  });
});
