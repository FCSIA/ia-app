import { describe, expect, test } from "vitest";
import { schoolDayBounds, weekStart } from "../analytics/_days";
import { nextActivity, schoolHour } from "./_activity";

const hour = 60 * 60 * 1000;
// Thursday, Oct 1 2026, 9:15 in New York.
const thursdayMorning = schoolDayBounds("2026-10-01").start + 9 * hour + 15 * 60_000;

describe("activity marks", () => {
  test("a person's first heartbeat counts toward every total", () => {
    expect(nextActivity(null, "ios", thursdayMorning)?.mark).toEqual({
      day: "2026-10-01",
      hour: 9,
      platform: "ios",
      newHour: true,
      newDay: true,
      newWeek: true,
      newPlatformDay: true,
    });
  });

  test("later heartbeats in the same hour on the same platform write nothing", () => {
    const first = nextActivity(null, "ios", thursdayMorning)!;

    expect(nextActivity(first.lastSeen, "ios", thursdayMorning + 20 * 60_000)).toBeNull();
  });

  test("a second platform in the same hour counts for that platform only", () => {
    const first = nextActivity(null, "ios", thursdayMorning)!;
    const laptop = nextActivity(first.lastSeen, "desktop", thursdayMorning + 60_000);

    expect(laptop?.mark).toMatchObject({ newHour: false, newDay: false, newPlatformDay: true });
  });

  test("a new hour, day, and week each count once", () => {
    const first = nextActivity(null, "ios", thursdayMorning)!;
    const later = nextActivity(first.lastSeen, "ios", thursdayMorning + hour)!;
    const tomorrow = nextActivity(later.lastSeen, "ios", thursdayMorning + 24 * hour)!;
    const monday = nextActivity(tomorrow.lastSeen, "ios", thursdayMorning + 4 * 24 * hour)!;

    expect(later.mark).toMatchObject({ hour: 10, newHour: true, newDay: false, newWeek: false });
    expect(tomorrow.mark).toMatchObject({ day: "2026-10-02", newDay: true, newWeek: false });
    expect(monday.mark).toMatchObject({ day: "2026-10-05", newDay: true, newWeek: true });
  });

  test("hours and weeks follow the school's clock", () => {
    expect(schoolHour(schoolDayBounds("2026-11-01").start)).toBe(0);
    expect(schoolHour(schoolDayBounds("2026-11-01").end - 1)).toBe(23);
    expect(weekStart("2026-10-04")).toBe("2026-09-28");
    expect(weekStart("2026-10-05")).toBe("2026-10-05");
  });
});
