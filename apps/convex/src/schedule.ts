import { ConvexError, v, type Infer } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  BASE_BLOCKS,
  SCHEDULE_WEEKDAYS,
  buildScheduleCourses,
  compareStudents,
  stableScheduleVisibility,
} from "../seed-data/schedule";
import { logAuditEvent } from "./lib/audit";
import { getCurrentAppUser } from "./lib/currentUser";
import {
  getFriendshipBetween,
  isStudentUser,
  normalizeBlockInput,
  normalizeScheduleEntries,
  requireScheduleAdmin,
  requireStudentUser,
  scheduleDashboardValidator,
  scheduleSearchResultValidator,
  serializeBlock,
  serializeScheduleForUser,
  serializeUser,
  schoolDayBlockValidator,
  studentScheduleRecordValidator,
  validateBlockConflicts,
} from "./lib/schedule";
import { scheduleWeekdayValidator, schoolDayBlockKindValidator } from "./validators";

type ScheduleSearchFriendshipStatus =
  | "NONE"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "FRIENDS";
type ScheduleSearchResult = Infer<typeof scheduleSearchResultValidator>;

const scheduleSeedResultValidator = v.object({
  blocksInserted: v.number(),
  schedulesUpserted: v.number(),
  entriesInserted: v.number(),
  friendshipsInserted: v.number(),
  deleted: v.object({
    entries: v.number(),
    schedules: v.number(),
    friendships: v.number(),
    blocks: v.number(),
  }),
  nextCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});

function studentVisibility(schedule: { isPublic: boolean } | null) {
  if (!schedule) return "NONE" as const;
  return schedule.isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const);
}

async function deliverNotification(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    title: string;
    body: string;
  },
) {
  await ctx.db.insert("notificationDeliveries", {
    userId: input.userId,
    category: "FRIEND_REQUEST",
    title: input.title,
    body: input.body,
    isRead: false,
    createdAt: Date.now(),
  });
}

async function getStudentTarget(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user || !user.isActive || !isStudentUser(user)) {
    throw new ConvexError("Student not found.");
  }
  return user;
}

async function deleteSeedBatch(ctx: MutationCtx) {
  const deleted = {
    entries: 0,
    schedules: 0,
    friendships: 0,
    blocks: 0,
  };

  const entries = await ctx.db.query("studentScheduleEntries").take(1000);
  for (const entry of entries) {
    await ctx.db.delete(entry._id);
    deleted.entries += 1;
  }

  if (entries.length === 0) {
    const schedules = await ctx.db.query("studentSchedules").take(500);
    for (const schedule of schedules) {
      await ctx.db.delete(schedule._id);
      deleted.schedules += 1;
    }

    const friendships = await ctx.db.query("studentScheduleFriends").take(500);
    for (const friendship of friendships) {
      await ctx.db.delete(friendship._id);
      deleted.friendships += 1;
    }

    const blocks = await ctx.db.query("schoolDayBlocks").take(100);
    for (const block of blocks) {
      await ctx.db.delete(block._id);
      deleted.blocks += 1;
    }
  }

  return deleted;
}

async function seedDefaultBlocks(ctx: MutationCtx, actorId: Id<"users">, now: number) {
  let blocksInserted = 0;
  for (const weekday of SCHEDULE_WEEKDAYS) {
    for (const block of BASE_BLOCKS) {
      const existing = await ctx.db
        .query("schoolDayBlocks")
        .withIndex("by_weekday_and_startTime", (q) =>
          q.eq("weekday", weekday).eq("startTime", block.startTime),
        )
        .unique();
      if (existing) continue;
      await ctx.db.insert("schoolDayBlocks", {
        weekday,
        label: block.label,
        periodNumber: block.periodNumber ?? undefined,
        startTime: block.startTime,
        endTime: block.endTime,
        createdById: actorId,
        createdAt: now,
        updatedAt: now,
      });
      blocksInserted += 1;
    }
  }
  return blocksInserted;
}

async function seedAcceptedFriendPairs(
  ctx: MutationCtx,
  students: Doc<"users">[],
  now: number,
) {
  let friendshipsInserted = 0;
  const pairCount = Math.min(Math.floor(students.length / 2), 180);

  for (let index = 0; index < pairCount * 2; index += 2) {
    const requester = students[index];
    const addressee = students[index + 1];
    if (!requester || !addressee) continue;

    const existing = await getFriendshipBetween(ctx, requester._id, addressee._id);
    if (existing) continue;

    await ctx.db.insert("studentScheduleFriends", {
      requesterId: requester._id,
      addresseeId: addressee._id,
      status: "ACCEPTED",
      createdAt: now,
      acceptedAt: now,
    });
    friendshipsInserted += 1;
  }

  return friendshipsInserted;
}

export const dashboard = query({
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
    const blocksInserted = isFirstPage ? await seedDefaultBlocks(ctx, actor._id, now) : 0;
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
            weekday,
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

export const saveMine = mutation({
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

export const searchPeople = query({
  args: {
    query: v.string(),
    limit: v.optional(v.number()),
  },
  returns: v.array(scheduleSearchResultValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const search = args.query.trim().toLowerCase();
    if (search.length < 2) return [];
    const limit = Math.min(Math.max(args.limit ?? 20, 1), 50);

    const candidates = await ctx.db
      .query("users")
      .withSearchIndex("search_users", (q) =>
        q.search("searchText", search).eq("isStudent", true),
      )
      .take(limit + 10);

    const results: ScheduleSearchResult[] = [];
    for (const candidate of candidates) {
      if (candidate._id === user._id || !candidate.isActive) continue;
      const friendship = await getFriendshipBetween(ctx, user._id, candidate._id);
      const schedule = await serializeScheduleForUser(ctx, candidate._id);
      const friendshipStatus: ScheduleSearchFriendshipStatus =
        friendship?.status === "ACCEPTED"
          ? "FRIENDS"
          : friendship?.status === "PENDING" && friendship.requesterId === user._id
            ? "REQUEST_SENT"
            : friendship?.status === "PENDING" && friendship.addresseeId === user._id
              ? "REQUEST_RECEIVED"
              : "NONE";

      results.push({
        ...serializeUser(candidate),
        friendshipStatus,
        visibility: studentVisibility(schedule),
      });
      if (results.length >= limit) break;
    }
    return results;
  },
});

export const sendFriendRequest = mutation({
  args: { friendId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    status: v.union(v.literal("PENDING"), v.literal("ACCEPTED")),
    id: v.id("studentScheduleFriends"),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    if (args.friendId === user._id) throw new ConvexError("You cannot friend yourself.");
    const target = await getStudentTarget(ctx, args.friendId);

    const existing = await getFriendshipBetween(ctx, user._id, args.friendId);
    if (existing) {
      if (existing.status === "ACCEPTED") throw new ConvexError("Already friends.");
      if (existing.addresseeId === user._id) {
        await ctx.db.patch(existing._id, {
          status: "ACCEPTED",
          acceptedAt: Date.now(),
        });
        await logAuditEvent(ctx, {
          actorId: user._id,
          action: "schedule.friend_accepted",
          entityType: "user",
          entityId: target._id,
        });
        await deliverNotification(ctx, {
          userId: target._id,
          title: "Friend request accepted",
          body: `${user.firstName} ${user.lastName} accepted your friend request.`,
        });
        return { success: true, status: "ACCEPTED" as const, id: existing._id };
      }
      throw new ConvexError("Friend request already sent.");
    }

    const id = await ctx.db.insert("studentScheduleFriends", {
      requesterId: user._id,
      addresseeId: args.friendId,
      status: "PENDING",
      createdAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_requested",
      entityType: "user",
      entityId: target._id,
    });
    await deliverNotification(ctx, {
      userId: target._id,
      title: "New friend request",
      body: `${user.firstName} ${user.lastName} wants to be your friend.`,
    });
    return { success: true, status: "PENDING" as const, id };
  },
});

export const acceptFriendRequest = mutation({
  args: { requesterId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const request = await ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_requesterId_and_addresseeId", (q) =>
        q.eq("requesterId", args.requesterId).eq("addresseeId", user._id),
      )
      .unique();
    if (!request || request.status !== "PENDING") {
      throw new ConvexError("Friend request not found.");
    }

    await ctx.db.patch(request._id, {
      status: "ACCEPTED",
      acceptedAt: Date.now(),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_accepted",
      entityType: "user",
      entityId: args.requesterId,
    });
    await deliverNotification(ctx, {
      userId: args.requesterId,
      title: "Friend request accepted",
      body: `${user.firstName} ${user.lastName} accepted your friend request.`,
    });
    return { success: true };
  },
});

export const removeFriend = mutation({
  args: { otherUserId: v.id("users") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireStudentUser(user);
    const friendship = await getFriendshipBetween(ctx, user._id, args.otherUserId);
    if (!friendship) throw new ConvexError("Friendship not found.");
    await ctx.db.delete(friendship._id);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schedule.friend_removed",
      entityType: "user",
      entityId: args.otherUserId,
    });
    return { success: true };
  },
});

export const createBlock = mutation({
  args: {
    weekday: scheduleWeekdayValidator,
    kind: schoolDayBlockKindValidator,
    periodNumber: v.optional(v.number()),
    label: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
  },
  returns: schoolDayBlockValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const normalized = await normalizeBlockInput(args);
    await validateBlockConflicts(ctx, normalized);
    const now = Date.now();
    const id = await ctx.db.insert("schoolDayBlocks", {
      weekday: normalized.weekday,
      label: normalized.label,
      periodNumber: normalized.periodNumber,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const block = await ctx.db.get(id);
    if (!block) throw new ConvexError("Block not found.");
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayBlock.created",
      entityType: "schoolDayBlock",
      entityId: id,
      meta: { weekday: block.weekday, label: block.label },
    });
    return serializeBlock(block);
  },
});

export const updateBlock = mutation({
  args: {
    blockId: v.id("schoolDayBlocks"),
    weekday: v.optional(scheduleWeekdayValidator),
    kind: v.optional(schoolDayBlockKindValidator),
    periodNumber: v.optional(v.number()),
    label: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  returns: schoolDayBlockValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const existing = await ctx.db.get(args.blockId);
    if (!existing) throw new ConvexError("Block not found.");
    const normalized = await normalizeBlockInput(args, existing);
    await validateBlockConflicts(ctx, normalized, args.blockId);
    await ctx.db.patch(args.blockId, {
      weekday: normalized.weekday,
      label: normalized.label,
      periodNumber: normalized.periodNumber,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      updatedAt: Date.now(),
    });
    const block = await ctx.db.get(args.blockId);
    if (!block) throw new ConvexError("Block not found.");
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayBlock.updated",
      entityType: "schoolDayBlock",
      entityId: block._id,
      meta: { weekday: block.weekday, label: block.label },
    });
    return serializeBlock(block);
  },
});

export const deleteBlock = mutation({
  args: { blockId: v.id("schoolDayBlocks") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const block = await ctx.db.get(args.blockId);
    if (!block) throw new ConvexError("Block not found.");
    await ctx.db.delete(args.blockId);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayBlock.deleted",
      entityType: "schoolDayBlock",
      entityId: args.blockId,
      meta: { weekday: block.weekday, label: block.label },
    });
    return { success: true };
  },
});
