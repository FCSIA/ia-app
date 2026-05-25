import { v } from "convex/values";
import { query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";

export const FLEX_CREDITS_REQUIRED_PER_YEAR = 12;
export const FLEX_CREDITS_REQUIRED_PER_SEMESTER = 6;

function schoolYearStart(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

function schoolYearRange(startYear: number) {
  const start = new Date(startYear, 7, 1).getTime();
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999).getTime();
  return { start, end };
}

function semesterRanges(startYear: number) {
  return [
    {
      key: "FALL" as const,
      label: `Fall ${startYear}`,
      start: new Date(startYear, 7, 1).getTime(),
      end: new Date(startYear, 11, 31, 23, 59, 59, 999).getTime(),
    },
    {
      key: "SPRING" as const,
      label: `Spring ${startYear + 1}`,
      start: new Date(startYear + 1, 0, 1).getTime(),
      end: new Date(startYear + 1, 4, 31, 23, 59, 59, 999).getTime(),
    },
  ];
}

export const getMyCredits = query({
  args: { schoolYearStart: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const start = args.schoolYearStart ?? schoolYearStart(new Date());
    const { start: rangeStart, end: rangeEnd } = schoolYearRange(start);

    const attendances = await ctx.db
      .query("flexAttendances")
      .withIndex("by_studentId_and_flexFridayId", (q) => q.eq("studentId", user._id))
      .collect();

    const inRange = await Promise.all(
      attendances.map(async (row) => {
        const friday = await ctx.db.get(row.flexFridayId);
        if (!friday || friday.date < rangeStart || friday.date > rangeEnd) {
          return null;
        }
        const workshop = await ctx.db.get(row.workshopId);
        return {
          ...row,
          workshop: workshop
            ? { _id: workshop._id, title: workshop.title }
            : null,
          flexFriday: {
            _id: friday._id,
            date: friday.date,
            type: friday.type,
          },
        };
      }),
    );

    const scoped = inRange.filter(
      (row): row is NonNullable<typeof row> => row !== null,
    );
    const presentAttendances = scoped.filter((a) => a.status === "PRESENT");
    const earned = presentAttendances.length;

    const semesters = semesterRanges(start).map((sem) => {
      const semEarned = presentAttendances.filter(
        (a) => a.flexFriday.date >= sem.start && a.flexFriday.date <= sem.end,
      ).length;
      return {
        key: sem.key,
        label: sem.label,
        required: FLEX_CREDITS_REQUIRED_PER_SEMESTER,
        earned: semEarned,
        remaining: Math.max(FLEX_CREDITS_REQUIRED_PER_SEMESTER - semEarned, 0),
      };
    });

    return {
      studentId: user._id,
      schoolYearStart: start,
      schoolYearLabel: `${start}-${String(start + 1).slice(-2)}`,
      required: FLEX_CREDITS_REQUIRED_PER_YEAR,
      earned,
      remaining: Math.max(FLEX_CREDITS_REQUIRED_PER_YEAR - earned, 0),
      semesters,
      attendances: scoped,
    };
  },
});
