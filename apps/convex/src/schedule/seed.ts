import { ConvexError, v } from "convex/values";
import { internalMutation } from "../_generated/server";
import {
  BASE_BLOCKS,
  REGULAR_TEMPLATE_BLOCKS,
  SCHEDULE_WEEKDAYS,
  buildScheduleCourses,
  compareStudents,
  stableScheduleVisibility,
  stableLunchPeriod,
} from "../../seed-data/schedule";
import {
  isStudentUser,
  scheduleSeedResultValidator,
  deleteSeedBatch,
  getFriendshipBetween,
  seedDefaultBlocks,
  seedAcceptedFriendPairs,
  seedRegularDayTemplate,
} from "./_lib";

export const seedFromStaticData = internalMutation({
  args: {
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: scheduleSeedResultValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const cursor = Math.max(0, Number.parseInt(args.cursor ?? "0", 10) || 0);
    const batchSize = Math.min(
      Math.max(Math.floor(args.batchSize ?? 20), 1),
      25,
    );
    const deleted =
      args.reset && cursor === 0
        ? await deleteSeedBatch(ctx)
        : { entries: 0, schedules: 0, friendships: 0, blocks: 0 };

    if (
      deleted.entries > 0 ||
      deleted.schedules > 0 ||
      deleted.friendships > 0 ||
      deleted.blocks > 0
    ) {
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
    const actor =
      users.find(
        (user) =>
          user.roles.includes("SUPER_ADMIN") || user.roles.includes("ADMIN"),
      ) ?? users[0];
    if (!actor) throw new ConvexError("Seed users before schedule fixtures.");

    const courses = await ctx.db.query("courses").take(1000);
    if (courses.length === 0)
      throw new ConvexError("Seed courses before schedule fixtures.");
    const courseMap = new Map(courses.map((course) => [course.slug, course]));

    const isFirstPage = cursor === 0;
    const blocksInserted = isFirstPage
      ? await seedDefaultBlocks(
          ctx,
          actor._id,
          now,
          SCHEDULE_WEEKDAYS,
          BASE_BLOCKS as unknown as any[],
        )
      : 0;
    const friendshipsInserted = isFirstPage
      ? await seedAcceptedFriendPairs(ctx, students, now)
      : 0;
    if (isFirstPage) {
      await seedRegularDayTemplate(
        ctx,
        actor._id,
        now,
        REGULAR_TEMPLATE_BLOCKS,
      );
    }

    let schedulesUpserted = 0;
    let entriesInserted = 0;

    for (const student of students.slice(cursor, cursor + batchSize)) {
      const scheduleCourses = buildScheduleCourses(student, courseMap);
      if (scheduleCourses.length === 0) continue;
      const lunchPeriod = stableLunchPeriod(student.uniqueId);
      const lunchNumber = lunchPeriod === "PERIOD_4" ? 4 : 5;
      const instructionalPeriods = [1, 2, 3, 4, 5, 6, 7, 8].filter(
        (periodNumber) => periodNumber !== lunchNumber,
      );

      const existingSchedule = await ctx.db
        .query("studentSchedules")
        .withIndex("by_userId", (q) => q.eq("userId", student._id))
        .unique();
      const scheduleId =
        existingSchedule?._id ??
        (await ctx.db.insert("studentSchedules", {
          userId: student._id,
          isPublic: stableScheduleVisibility(student.uniqueId),
          lunchPeriod,
          createdAt: now,
          updatedAt: now,
        }));

      if (existingSchedule) {
        await ctx.db.patch(existingSchedule._id, {
          isPublic: stableScheduleVisibility(student.uniqueId),
          lunchPeriod,
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

    for (const [index, course] of scheduleCourses
        .slice(0, instructionalPeriods.length)
        .entries()) {
        const periodNumber = instructionalPeriods[index];
        if (!periodNumber) continue;
        for (const weekday of SCHEDULE_WEEKDAYS) {
          await ctx.db.insert("studentScheduleEntries", {
            scheduleId,
            userId: student._id,
            courseId: course._id,
            weekday: weekday as any,
            periodNumber,
            className: course.title,
            createdAt: now,
            updatedAt: now,
          });
          entriesInserted += 1;
        }
      }
    }

    const nextIndex = cursor + batchSize;
    if (nextIndex >= students.length) {
      const owner = students.find((student) => student.uniqueId === "STU001");
      if (owner) {
        const existingGroups = await ctx.db
          .query("studentScheduleGroups")
          .withIndex("by_ownerId_and_createdAt", (q) =>
            q.eq("ownerId", owner._id),
          )
          .take(1);
        if (existingGroups.length === 0) {
          const groupId = await ctx.db.insert("studentScheduleGroups", {
            ownerId: owner._id,
            name: "Shared Classes Demo",
            createdAt: now,
            updatedAt: now,
          });
          const [outgoing, incoming] = await Promise.all([
            ctx.db
              .query("studentScheduleFriends")
              .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
                q.eq("requesterId", owner._id).eq("status", "ACCEPTED"),
              )
              .take(4),
            ctx.db
              .query("studentScheduleFriends")
              .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
                q.eq("addresseeId", owner._id).eq("status", "ACCEPTED"),
              )
              .take(4),
          ]);
          const friendIds = Array.from(
            new Set([
              ...outgoing.map((friendship) => friendship.addresseeId),
              ...incoming.map((friendship) => friendship.requesterId),
            ]),
          ).slice(0, 4);
          for (const friendId of friendIds) {
            await ctx.db.insert("studentScheduleGroupMembers", {
              groupId,
              userId: friendId,
              addedAt: now,
            });
          }
        }
      }
    }

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
