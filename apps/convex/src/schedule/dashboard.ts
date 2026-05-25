import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import {
  isStudentUser,
  serializeScheduleForUser,
  serializeBlock,
  serializeUser,
  studentVisibility,
  scheduleDashboardValidator,
  studentScheduleRecordValidator,
  normalizeScheduleEntries,
  requireStudentUser,
} from "./_lib";
import { logAuditEvent } from "../audit/_lib";
import { scheduleWeekdayValidator } from "../validators";
import { Id, Doc } from "../_generated/dataModel";

export const get = query({
  args: {},
  returns: scheduleDashboardValidator,
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const isStudent = isStudentUser(user);

    const [mySchedule, blocks] = await Promise.all([
      isStudent ? serializeScheduleForUser(ctx, user._id) : Promise.resolve(null),
      ctx.db.query("schoolDayBlocks").take(250),
    ]);

    const friends = [];
    const incomingRequests = [];
    const outgoingRequests = [];

    if (isStudent) {
      const outgoing = await ctx.db
        .query("studentScheduleFriends")
        .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
          q.eq("requesterId", user._id),
        )
        .take(500);
      const incoming = await ctx.db
        .query("studentScheduleFriends")
        .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
          q.eq("addresseeId", user._id),
        )
        .take(500);

      for (const friendship of [...outgoing, ...incoming]) {
        const otherUserId =
          friendship.requesterId === user._id
            ? friendship.addresseeId
            : friendship.requesterId;
        const other = await ctx.db.get(otherUserId);
        if (!other || !other.isActive || !isStudentUser(other)) continue;

        if (friendship.status === "PENDING") {
          const request = {
            id: friendship._id,
            user: serializeUser(other),
            createdAt: new Date(friendship.createdAt).toISOString(),
          };
          if (friendship.addresseeId === user._id) incomingRequests.push(request);
          else outgoingRequests.push(request);
          continue;
        }

        const otherSchedule = await serializeScheduleForUser(ctx, other._id);
        const visibility = studentVisibility(otherSchedule);
        friends.push({
          id: friendship._id,
          user: serializeUser(other),
          visibility,
          schedule: visibility === "PUBLIC" ? otherSchedule : null,
        });
      }
    }

    friends.sort(
      (left, right) =>
        left.user.lastName.localeCompare(right.user.lastName) ||
        left.user.firstName.localeCompare(right.user.firstName),
    );

    return {
      mySchedule,
      blocks: blocks.map(serializeBlock).sort(
        (left, right) =>
          left.weekday.localeCompare(right.weekday) ||
          left.startTime.localeCompare(right.startTime),
      ),
      friends,
      incomingRequests,
      outgoingRequests,
    };
  },
});

export const save = mutation({
  args: {
    isPublic: v.boolean(),
    entries: v.array(v.object({
      weekday: scheduleWeekdayValidator,
      periodNumber: v.number(),
      courseId: v.id("courses"),
    })),
  },
  returns: v.union(studentScheduleRecordValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const entries = normalizeScheduleEntries(args.entries);
    const now = Date.now();

    const coursesById = new Map<Id<"courses">, Doc<"courses">>();
    for (const entry of entries) {
      const course = await ctx.db.get(entry.courseId);
      if (!course) throw new ConvexError("One or more selected courses were not found.");
      coursesById.set(entry.courseId, course);
    }

    const existing = await ctx.db
      .query("studentSchedules")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const scheduleId =
      existing?._id ??
      (await ctx.db.insert("studentSchedules", {
        userId: user._id,
        isPublic: args.isPublic,
        createdAt: now,
        updatedAt: now,
      }));

    if (existing) {
      await ctx.db.patch(existing._id, {
        isPublic: args.isPublic,
        updatedAt: now,
      });
    }

    const oldEntries = await ctx.db
      .query("studentScheduleEntries")
      .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
        q.eq("scheduleId", scheduleId),
      )
      .take(60);
    for (const entry of oldEntries) {
      await ctx.db.delete(entry._id);
    }

    for (const entry of entries) {
      await ctx.db.insert("studentScheduleEntries", {
        scheduleId,
        userId: user._id,
        courseId: entry.courseId,
        weekday: entry.weekday,
        periodNumber: entry.periodNumber,
        className: coursesById.get(entry.courseId)!.title,
        createdAt: now,
        updatedAt: now,
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.updated",
      entityType: "studentSchedule",
      entityId: scheduleId,
      meta: { isPublic: args.isPublic, entryCount: entries.length },
    });

    return await serializeScheduleForUser(ctx, user._id);
  },
});
