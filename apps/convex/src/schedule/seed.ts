import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import {
  BASE_BLOCKS,
  SCHEDULE_WEEKDAYS,
  buildScheduleCourses,
  compareStudents,
  stableScheduleVisibility,
} from "../seeddata/schedule";
import {
  isStudentUser,
  scheduleSeedResultValidator,
  deleteSeedBatch,
  seedDefaultBlocks,
  seedAcceptedFriendPairs,
} from "./_lib";

export const seedFromStaticData = mutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: scheduleSeedResultValidator,
  handler: async (ctx, args) => {
    const expectedSecret = process.env.SCHEDULE_SEED_SECRET ?? process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new ConvexError("Invalid seed secret.");
    }

    const now = Date.now();
    const cursor = Math.max(0, Number.parseInt(args.cursor ?? "0", 10) || 0);
    const batchSize = Math.min(Math.max(Math.floor(args.batchSize ?? 20), 1), 25);
    const deleted = args.reset && cursor === 0
      ? await deleteSeedBatch(ctx)
      : { entries: 0, schedules: 0, friendships: 0, blocks: 0 };

    if (deleted.entries > 0 || deleted.schedules > 0 || deleted.friendships > 0 || deleted.blocks > 0) {
      return {
        blocksInserted: 0,
        schedulesUpserted: 0,
        entriesInserted: 0,
        friendshipsInserted: 0,
        deleted,
        nextCursor: "0",
        isDone: false,
      };
    }

    const users = await ctx.db.query("users").take(5000);
    const students = users
      .filter(
        (user) =>
          user.isActive &&
          isStudentUser(user) &&
          user.gradeLevel &&
          user.major &&
          user.minor,
      )
      .sort(compareStudents);
    const actor = users.find(
      (user) => user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"),
    )
      ?? users[0];
    if (!actor) throw new ConvexError("Seed users before schedule fixtures.");

    const courses = await ctx.db.query("courses").take(1000);
    if (courses.length === 0) throw new ConvexError("Seed courses before schedule fixtures.");
    const courseMap = new Map(courses.map((course) => [course.slug, course]));

    const isFirstPage = cursor === 0;
    const blocksInserted = isFirstPage ? await seedDefaultBlocks(ctx, actor._id, now, SCHEDULE_WEEKDAYS, BASE_BLOCKS as unknown as any[]) : 0;
    const friendshipsInserted = isFirstPage ? await seedAcceptedFriendPairs(ctx, students, now) : 0;

    let schedulesUpserted = 0;
    let entriesInserted = 0;

    for (const student of students.slice(cursor, cursor + batchSize)) {
      const scheduleCourses = buildScheduleCourses(student, courseMap);
      if (scheduleCourses.length === 0) continue;

      const existingSchedule = await ctx.db
        .query("studentSchedules")
        .withIndex("by_userId", (q) => q.eq("userId", student._id))
        .unique();
      const scheduleId = existingSchedule?._id
        ?? await ctx.db.insert("studentSchedules", {
          userId: student._id,
          isPublic: stableScheduleVisibility(student.uniqueId),
          createdAt: now,
          updatedAt: now,
        });

      if (existingSchedule) {
        await ctx.db.patch(existingSchedule._id, {
          isPublic: stableScheduleVisibility(student.uniqueId),
          updatedAt: now,
        });
      }
      schedulesUpserted += 1;

      const oldEntries = await ctx.db
        .query("studentScheduleEntries")
        .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
          q.eq("scheduleId", scheduleId),
        )
        .take(60);
      for (const entry of oldEntries) {
        await ctx.db.delete(entry._id);
      }

      for (const [index, course] of scheduleCourses.entries()) {
        for (const weekday of SCHEDULE_WEEKDAYS) {
          await ctx.db.insert("studentScheduleEntries", {
            scheduleId,
            userId: student._id,
            courseId: course._id,
            weekday: weekday as any,
            periodNumber: index + 1,
            className: course.title,
            createdAt: now,
            updatedAt: now,
          });
          entriesInserted += 1;
        }
      }
    }

    const nextIndex = cursor + batchSize;
    return {
      blocksInserted,
      schedulesUpserted,
      entriesInserted,
      friendshipsInserted,
      deleted,
      nextCursor: nextIndex < students.length ? String(nextIndex) : null,
      isDone: nextIndex >= students.length,
    };
  },
});
