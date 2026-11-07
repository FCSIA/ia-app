import { getFunctionName } from "convex/server";
import { describe, expect, test } from "vitest";
import {
  prewarmEntries,
  type PrewarmTab,
} from "./tab-queries";
import { keepAliveKey } from "./convex-react";

const student = { roles: ["STUDENT"] };
const teacher = { roles: ["TEACHER"] };
const admin = { roles: ["ADMIN"] };
const adminStudent = { roles: ["ADMIN", "STUDENT"] };

const keys = (entries: Array<{ query: never; args?: unknown }>) =>
  entries.map((entry) => keepAliveKey(entry.query, entry.args as never)).sort();

const noon = new Date(2026, 10, 4, 12, 0);

describe("tab prewarm", () => {
  test("each persona's Home warms its own widgets' queries", () => {
    const names = (user: { roles: string[] }) =>
      prewarmEntries("dashboard", user, noon).map((entry) => getFunctionName(entry.query)).sort();
    const shared = [
      "announcements/feed:list",
      "announcements/feed:listPinned",
      "events/calendar:list",
      "schedule/dashboard:getDay",
    ];
    expect(names(student)).toEqual(
      [
        ...shared,
        "clubs/management:getMyClubs",
        "flexFriday/credits:getMyCredits",
        "flexFriday/registration:getMyRegistrations",
      ].sort(),
    );
    expect(names(teacher)).toEqual([...shared, "flexFriday/fridays:list"].sort());
  });

  test("the dashboard warms the pinned feed and the school day the screens read", () => {
    const names = prewarmEntries("dashboard", teacher, noon).map((entry) =>
      getFunctionName(entry.query),
    );
    expect(names).toContain("announcements/feed:listPinned");
    expect(names).toContain("schedule/dashboard:getDay");
  });

  test("a prewarm later the same day is the same subscription", () => {
    const later = new Date(2026, 10, 4, 15, 30);
    expect(keys(prewarmEntries("dashboard", student, later) as never)).toEqual(
      keys(prewarmEntries("dashboard", student, noon) as never),
    );
  });

  test("the calendar follows the screen's student check, not the Home persona", () => {
    const names = (user: { roles: string[] }) =>
      prewarmEntries("calendar", user, noon).map((entry) => getFunctionName(entry.query));
    expect(names(adminStudent)).toContain("schedule/dashboard:get");
    expect(names(admin)).toContain("events/calendar:listPendingInvites");
    expect(names(admin)).not.toContain("schedule/dashboard:get");
  });

  test("tabs that page or only navigate warm nothing", () => {
    const tabs: PrewarmTab[] = ["announcements", "discover"];
    for (const tab of tabs) expect(prewarmEntries(tab, student, noon)).toEqual([]);
  });
});
