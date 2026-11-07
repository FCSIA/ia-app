/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import { api } from "../_generated/api";
import schema from "../schema";
import { insertUser } from "../../test/fixtures";
import { schoolYearRange } from "../../../shared/school-time";
import { flexAttendancesInRange } from "./_credits";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

const modules = import.meta.glob("/src/**/*.*s");

const SCHOOL_YEAR = 2025;
const inYear = (month: number) => new Date(SCHOOL_YEAR, month, 15).getTime();

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const studentId = await insertUser(ctx, { uniqueId: "CREDITS" });
    const teacherId = await insertUser(ctx, { uniqueId: "TEACHER", roles: ["TEACHER"] });
    const workshopId = await ctx.db.insert("flexWorkshops", {
      teacherId,
      title: "Robotics",
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
      createdAt: 1,
      updatedAt: 1,
    });
    const attend = async (date: number, status: "PRESENT" | "ABSENT") => {
      const flexFridayId = await ctx.db.insert("flexFridays", {
        date,
        type: "ALL_STUDENT",
        isSchoolDay: true,
        createdAt: 1,
      });
      return ctx.db.insert("flexAttendances", {
        workshopId,
        studentId,
        flexFridayId,
        status,
        markedById: teacherId,
        markedAt: 1,
        updatedAt: 1,
      });
    };
    await attend(inYear(8), "PRESENT");
    await attend(inYear(9), "ABSENT");
    await attend(inYear(10), "PRESENT");
    await attend(new Date(SCHOOL_YEAR - 1, 8, 15).getTime(), "PRESENT");
    return { studentId };
  });
  return { t, ...ids };
}

describe("flexAttendancesInRange", () => {
  const range = schoolYearRange(SCHOOL_YEAR);

  test("returns every status in the range with its Friday, leaving out other years", async () => {
    const { t, studentId } = await fixture();

    const rows = await t.run((ctx) => flexAttendancesInRange(ctx, studentId, range));

    expect(rows.map((row) => row.attendance.status).sort()).toEqual(["ABSENT", "PRESENT", "PRESENT"]);
    expect(rows.every((row) => row.friday.date >= range.start && row.friday.date <= range.end)).toBe(true);
  });

  test("presentOnly keeps the credits", async () => {
    const { t, studentId } = await fixture();

    const rows = await t.run((ctx) =>
      flexAttendancesInRange(ctx, studentId, range, { presentOnly: true }),
    );

    expect(rows.map((row) => row.attendance.status)).toEqual(["PRESENT", "PRESENT"]);
  });

  test("limit bounds the rows read before the range filter", async () => {
    const { t, studentId } = await fixture();

    const rows = await t.run((ctx) => flexAttendancesInRange(ctx, studentId, range, { limit: 1 }));

    expect(rows).toHaveLength(1);
  });

  test("the credits query counts present rows only", async () => {
    const { t, studentId } = await fixture();

    const credits = await t
      .withIdentity({ subject: studentId })
      .query(api.flexFriday.credits.getMyCredits, { schoolYearStart: SCHOOL_YEAR });

    expect(credits).toMatchObject({ earned: 2, required: 12, remaining: 10 });
  });
});
