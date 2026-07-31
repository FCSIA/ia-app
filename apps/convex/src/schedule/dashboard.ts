import { ConvexError, v } from "convex/values";
import { query, mutation } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  isStudentUser,
  serializeScheduleForUser,
  serializeBlock,
  serializeUser,
  studentVisibility,
  scheduleDashboardValidator,
  scheduleEntryInputValidator,
  studentScheduleRecordValidator,
  normalizeScheduleEntries,
  requireStudentUser,
} from "./_lib";
import { logAuditEvent } from "../audit/_lib";
import { Id, Doc } from "../_generated/dataModel";
import {
  enqueueFriendScheduleChangeNotifications,
  scheduleMateriallyChanged,
  type MaterialScheduleSnapshot,
} from "./scheduleChangeNotifications";

export const get = query({
  args: {},
  returns: scheduleDashboardValidator,
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    const isStudent = user ? isStudentUser(user) : false;

    const [mySchedule, blocks] = await Promise.all([
      isStudent && user ? serializeScheduleForUser(ctx, user._id) : Promise.resolve(null),
      ctx.db.query("schoolDayBlocks").take(250),
    ]);

    const friends = [];
    const incomingRequests = [];
    const outgoingRequests = [];

    if (isStudent && user) {
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
    entries: v.array(scheduleEntryInputValidator),
  },
  returns: v.union(studentScheduleRecordValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const entries = normalizeScheduleEntries(args.entries);
    const now = Date.now();

    const coursesById = new Map<Id<"courses">, Doc<"courses">>();
    for (const entry of entries) {
      if (!entry.className.trim()) {
        throw new ConvexError("Class names cannot be empty.");
      }
      if (!entry.courseId) continue;
      const course = await ctx.db.get(entry.courseId);
      if (!course) throw new ConvexError("One or more selected courses were not found.");
      coursesById.set(entry.courseId, course);
    }

    const existing = await ctx.db
      .query("studentSchedules")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    const oldEntries = existing
      ? await ctx.db
          .query("studentScheduleEntries")
          .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
            q.eq("scheduleId", existing._id),
          )
          .take(60)
      : [];
    const resolvedEntries = entries.map((entry) => ({
      ...entry,
      className: entry.courseId
        ? coursesById.get(entry.courseId)!.title
        : entry.className.trim(),
    }));
    const previousSnapshot: MaterialScheduleSnapshot | null = existing
      ? {
          isPublic: existing.isPublic,
          entries: oldEntries.map(({ weekday, periodNumber, courseId, className }) => ({
            weekday,
            periodNumber,
            courseId,
            className,
          })),
        }
      : null;
    const nextSnapshot: MaterialScheduleSnapshot = {
      isPublic: args.isPublic,
      entries: resolvedEntries,
    };
    if (existing && !scheduleMateriallyChanged(previousSnapshot, nextSnapshot)) {
      return await serializeScheduleForUser(ctx, user._id);
    }
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

    for (const entry of oldEntries) {
      await ctx.db.delete(entry._id);
    }

    for (const entry of resolvedEntries) {
      await ctx.db.insert("studentScheduleEntries", {
        scheduleId,
        userId: user._id,
        courseId: entry.courseId,
        weekday: entry.weekday,
        periodNumber: entry.periodNumber,
        className: entry.className,
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

    await enqueueFriendScheduleChangeNotifications(ctx, {
      user,
      previous: previousSnapshot,
      next: nextSnapshot,
      scheduleUpdatedAt: now,
    });

    return await serializeScheduleForUser(ctx, user._id);
  },
});
