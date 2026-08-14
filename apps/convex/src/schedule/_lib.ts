import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  scheduleLunchPeriodValidator,
  scheduleWeekdayValidator,
  schoolDayBlockKindValidator,
} from "../validators";
import { toCourseSummary } from "../courses/_lib";
import type { AppRole } from "../../lib/roles";
import { deliverNotification as deliverNotificationRow } from "../notifications/delivery";
import {
  findLunchCourseConflict,
  normalizeDayBlocks,
  resolveLunchPeriod,
  type DayBlockInput,
} from "./dayResolver";

export const schoolDayBlockValidator = v.object({
  id: v.id("schoolDayBlocks"),
  weekday: scheduleWeekdayValidator,
  label: v.string(),
  periodNumber: v.union(v.number(), v.null()),
  startTime: v.string(),
  endTime: v.string(),
  durationMinutes: v.number(),
});

export const studentScheduleEntryValidator = v.object({
  id: v.optional(v.id("studentScheduleEntries")),
  weekday: scheduleWeekdayValidator,
  periodNumber: v.number(),
  className: v.string(),
  courseId: v.union(v.id("courses"), v.null()),
  course: v.union(v.any(), v.null()), // using any here to avoid circular dependency if possible, or just repeat the summary validator
});

// Since I want to avoid circular dependencies and keep it simple, I'll repeat or refer to courses/lib
// Actually, I can just use the validator from courses/lib if I import it correctly.

export const studentScheduleRecordValidator = v.object({
  id: v.id("studentSchedules"),
  isPublic: v.boolean(),
  lunchPeriod: v.union(scheduleLunchPeriodValidator, v.null()),
  lunchNeedsResolution: v.boolean(),
  entries: v.array(studentScheduleEntryValidator),
});

export const resolvedSchoolDayBlockValidator = v.object({
  key: v.string(),
  position: v.number(),
  label: v.string(),
  displayLabel: v.string(),
  periodNumber: v.union(v.number(), v.null()),
  startTime: v.string(),
  endTime: v.string(),
  durationMinutes: v.number(),
  kind: v.union(v.literal("PERIOD"), v.literal("LUNCH"), v.literal("CUSTOM")),
  entry: v.union(studentScheduleEntryValidator, v.null()),
});

export const resolvedSchoolDayValidator = v.object({
  dateKey: v.string(),
  weekday: v.union(scheduleWeekdayValidator, v.null()),
  calendarSetupRequired: v.boolean(),
  lunchPeriod: v.union(scheduleLunchPeriodValidator, v.null()),
  lunchNeedsResolution: v.boolean(),
  isSpecial: v.boolean(),
  name: v.string(),
  source: v.union(
    v.literal("REGULAR_TEMPLATE"),
    v.literal("DATE_OVERRIDE"),
    v.literal("UNASSIGNED"),
    v.literal("LEGACY"),
  ),
  sourceId: v.union(
    v.id("schoolDayTemplates"),
    v.id("schoolDayDateOverrides"),
    v.null(),
  ),
  sourceTemplateId: v.union(v.id("schoolDayTemplates"), v.null()),
  blocks: v.array(resolvedSchoolDayBlockValidator),
  omittedPeriods: v.array(v.number()),
});

export const scheduleFriendUserValidator = v.object({
  _id: v.id("users"),
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
});

export const scheduleFriendValidator = v.object({
  id: v.id("studentScheduleFriends"),
  user: scheduleFriendUserValidator,
  visibility: v.union(v.literal("PUBLIC"), v.literal("PRIVATE"), v.literal("NONE")),
  schedule: v.union(studentScheduleRecordValidator, v.null()),
});

export const scheduleFriendRequestValidator = v.object({
  id: v.id("studentScheduleFriends"),
  user: scheduleFriendUserValidator,
  createdAt: v.string(),
});

export const scheduleDashboardValidator = v.object({
  mySchedule: v.union(studentScheduleRecordValidator, v.null()),
  blocks: v.array(schoolDayBlockValidator),
  resolvedDay: resolvedSchoolDayValidator,
  friends: v.array(scheduleFriendValidator),
  incomingRequests: v.array(scheduleFriendRequestValidator),
  outgoingRequests: v.array(scheduleFriendRequestValidator),
});

export const scheduleSearchResultValidator = v.object({
  _id: v.id("users"),
  uniqueId: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  friendshipStatus: v.union(
    v.literal("NONE"),
    v.literal("REQUEST_SENT"),
    v.literal("REQUEST_RECEIVED"),
    v.literal("FRIENDS"),
  ),
  visibility: v.union(v.literal("PUBLIC"), v.literal("PRIVATE"), v.literal("NONE")),
});

export const scheduleBlockPayloadValidator = v.object({
  weekday: scheduleWeekdayValidator,
  kind: schoolDayBlockKindValidator,
  periodNumber: v.optional(v.number()),
  label: v.optional(v.string()),
  startTime: v.string(),
  endTime: v.string(),
});

export const scheduleEntryInputValidator = v.object({
  weekday: scheduleWeekdayValidator,
  periodNumber: v.number(),
  courseId: v.union(v.id("courses"), v.null()),
  className: v.string(),
});

export const scheduleSeedResultValidator = v.object({
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

export type ScheduleBlockPayload = Infer<typeof scheduleBlockPayloadValidator>;
export type ScheduleEntryInput = Infer<typeof scheduleEntryInputValidator>;
export type ScheduleSearchFriendshipStatus =
  | "NONE"
  | "REQUEST_SENT"
  | "REQUEST_RECEIVED"
  | "FRIENDS";
export type ScheduleSearchResult = Infer<typeof scheduleSearchResultValidator>;

const STUDENT_ROLES: AppRole[] = ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"];
const ADMIN_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN"];
const SCHEDULE_WEEKDAYS: ScheduleEntryInput["weekday"][] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
];

export const MAX_SCHEDULE_CLASS_NAME_CHARACTERS = 160;

export function normalizeScheduleClassName(value: string) {
  const normalized = value.trim();
  if (!normalized) throw new ConvexError("Class names cannot be empty.");
  if (Array.from(normalized).length > MAX_SCHEDULE_CLASS_NAME_CHARACTERS) {
    throw new ConvexError(
      `Class names must be at most ${MAX_SCHEDULE_CLASS_NAME_CHARACTERS} characters.`,
    );
  }
  return normalized;
}

export function isStudentUser(user: Doc<"users">) {
  return user.roles.some((role) => STUDENT_ROLES.includes(role));
}

export function requireStudentUser(user: Doc<"users">) {
  if (!isStudentUser(user)) {
    throw new ConvexError("Only student accounts can manage a personal schedule.");
  }
}

export function requireScheduleAdmin(user: Doc<"users">) {
  if (!user.roles.some((role) => ADMIN_ROLES.includes(role))) {
    throw new ConvexError("Forbidden");
  }
}

export function parseTimeString(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (!match) throw new ConvexError(`Invalid time "${value}".`);
  return Number.parseInt(match[1], 10) * 60 + Number.parseInt(match[2], 10);
}

export function serializeBlock(block: Doc<"schoolDayBlocks">) {
  return {
    id: block._id,
    weekday: block.weekday,
    label: block.label,
    periodNumber: block.periodNumber ?? null,
    startTime: block.startTime,
    endTime: block.endTime,
    durationMinutes: parseTimeString(block.endTime) - parseTimeString(block.startTime),
  };
}

export function serializeUser(user: Doc<"users">) {
  return {
    _id: user._id,
    uniqueId: user.uniqueId,
    firstName: user.firstName,
    lastName: user.lastName,
  };
}

export async function getScheduleForUser(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  return await ctx.db
    .query("studentSchedules")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
}

export async function serializeScheduleForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
) {
  const schedule = await getScheduleForUser(ctx, userId);
  if (!schedule) return null;

  const entries = await ctx.db
    .query("studentScheduleEntries")
    .withIndex("by_scheduleId_and_weekday_and_periodNumber", (q) =>
      q.eq("scheduleId", schedule._id),
    )
    .take(60);

  const serializedEntries = [];
  for (const entry of entries) {
    const course = entry.courseId ? await ctx.db.get(entry.courseId) : null;
    serializedEntries.push({
      id: entry._id,
      weekday: entry.weekday,
      periodNumber: entry.periodNumber,
      className: entry.className,
      courseId: entry.courseId,
      course: course ? toCourseSummary(course) : null,
    });
  }

  serializedEntries.sort(
    (left, right) =>
      left.weekday.localeCompare(right.weekday) ||
      left.periodNumber - right.periodNumber,
  );

  const inferredLunchPeriod = resolveLunchPeriod(
    schedule.lunchPeriod,
    serializedEntries,
  );
  const hasLunchConflict = inferredLunchPeriod
    ? findLunchCourseConflict(serializedEntries, inferredLunchPeriod) !== null
    : false;
  const lunchPeriod = hasLunchConflict ? null : inferredLunchPeriod;

  return {
    id: schedule._id,
    isPublic: schedule.isPublic,
    lunchPeriod,
    lunchNeedsResolution: lunchPeriod === null,
    entries: serializedEntries,
  };
}

export async function getFriendshipBetween(
  ctx: QueryCtx | MutationCtx,
  leftUserId: Id<"users">,
  rightUserId: Id<"users">,
) {
  const outgoing = await ctx.db
    .query("studentScheduleFriends")
    .withIndex("by_requesterId_and_addresseeId", (q) =>
      q.eq("requesterId", leftUserId).eq("addresseeId", rightUserId),
    )
    .unique();
  if (outgoing) return outgoing;

  return await ctx.db
    .query("studentScheduleFriends")
    .withIndex("by_requesterId_and_addresseeId", (q) =>
      q.eq("requesterId", rightUserId).eq("addresseeId", leftUserId),
    )
    .unique();
}

export function getScheduleFriendshipStatus(
  friendship:
    | Pick<Doc<"studentScheduleFriends">, "requesterId" | "addresseeId" | "status">
    | null,
  viewerId: Id<"users">,
): ScheduleSearchFriendshipStatus {
  if (!friendship) return "NONE";
  if (friendship.status === "ACCEPTED") return "FRIENDS";
  return friendship.requesterId === viewerId ? "REQUEST_SENT" : "REQUEST_RECEIVED";
}

export function normalizeScheduleEntries(entries: ScheduleEntryInput[]) {
  const seen = new Set<string>();
  const normalizedEntries = entries.map((entry) => {
    if (entry.periodNumber < 1 || entry.periodNumber > 8) {
      throw new ConvexError("Schedule periods must be between 1 and 8.");
    }

    const key = `${entry.weekday}:${entry.periodNumber}`;
    if (seen.has(key)) {
      throw new ConvexError(`Duplicate schedule entry for ${entry.weekday} period ${entry.periodNumber}.`);
    }
    seen.add(key);
    return entry;
  });

  return Array.from({ length: 8 }, (_, index) => index + 1).flatMap(
    (periodNumber) => {
      const canonicalEntry = SCHEDULE_WEEKDAYS.map((weekday) =>
        normalizedEntries.find(
          (entry) =>
            entry.weekday === weekday && entry.periodNumber === periodNumber,
        ),
      ).find((entry) => entry !== undefined);
      return canonicalEntry
        ? SCHEDULE_WEEKDAYS.map((weekday) => ({ ...canonicalEntry, weekday }))
        : [];
    },
  );
}

export async function listBlocksForWeekday(
  ctx: QueryCtx | MutationCtx,
  weekday: ScheduleBlockPayload["weekday"],
  ignoreId?: Id<"schoolDayBlocks">,
) {
  const blocks = await ctx.db
    .query("schoolDayBlocks")
    .withIndex("by_weekday_and_startTime", (q) => q.eq("weekday", weekday))
    .take(50);

  return blocks
    .filter((block) => block._id !== ignoreId)
    .map((block) => ({
      ...block,
      startMinutes: parseTimeString(block.startTime),
      endMinutes: parseTimeString(block.endTime),
    }));
}

export async function normalizeBlockInput(
  input: Partial<ScheduleBlockPayload>,
  existing?: Doc<"schoolDayBlocks">,
) {
  const weekday = input.weekday ?? existing?.weekday;
  if (!weekday) throw new ConvexError("Weekday is required.");

  const kind = input.kind ?? (existing?.periodNumber ? "PERIOD" : "CUSTOM");
  const startTime = input.startTime ?? existing?.startTime;
  const endTime = input.endTime ?? existing?.endTime;
  if (!startTime || !endTime) {
    throw new ConvexError("Start and end time are required.");
  }

  const startMinutes = parseTimeString(startTime);
  const endMinutes = parseTimeString(endTime);
  if (endMinutes <= startMinutes) {
    throw new ConvexError("End time must be after start time.");
  }

  const periodNumber =
    kind === "PERIOD"
      ? input.periodNumber ?? existing?.periodNumber ?? undefined
      : undefined;
  if (kind === "PERIOD" && (!periodNumber || periodNumber < 1 || periodNumber > 8)) {
    throw new ConvexError("Period blocks must use a period number between 1 and 8.");
  }

  const label =
    kind === "PERIOD"
      ? `Period ${periodNumber}`
      : (input.label ?? existing?.label ?? "").trim();
  if (kind === "CUSTOM" && !label) {
    throw new ConvexError("Custom blocks require a label.");
  }

  return {
    weekday,
    label,
    periodNumber: periodNumber ?? undefined,
    startTime,
    endTime,
    startMinutes,
    endMinutes,
  };
}

export async function validateBlockConflicts(
  ctx: QueryCtx | MutationCtx,
  block: {
    weekday: ScheduleBlockPayload["weekday"];
    periodNumber?: number;
    startMinutes: number;
    endMinutes: number;
  },
  ignoreId?: Id<"schoolDayBlocks">,
) {
  const existingBlocks = await listBlocksForWeekday(ctx, block.weekday, ignoreId);
  if (
    block.periodNumber &&
    existingBlocks.some((existing) => existing.periodNumber === block.periodNumber)
  ) {
    throw new ConvexError(`Period ${block.periodNumber} already exists on ${block.weekday}.`);
  }

  const overlap = existingBlocks.find(
    (existing) =>
      block.startMinutes < existing.endMinutes &&
      block.endMinutes > existing.startMinutes,
  );
  if (overlap) {
    throw new ConvexError("Blocks cannot overlap on the same day.");
  }
}

export function studentVisibility(schedule: { isPublic: boolean } | null) {
  if (!schedule) return "NONE" as const;
  return schedule.isPublic ? ("PUBLIC" as const) : ("PRIVATE" as const);
}

export async function deliverNotification(
  ctx: MutationCtx,
  input: {
    userId: Id<"users">;
    friendshipId: Id<"studentScheduleFriends">;
    title: string;
    body: string;
    href?: string;
  },
) {
  await deliverNotificationRow(ctx, {
    userId: input.userId,
    category: "FRIEND_REQUEST",
    title: input.title,
    body: input.body,
    href: input.href ?? "/schedule?tab=friends",
    subject: { kind: "friendRequest", friendshipId: input.friendshipId },
  });
}

export async function getStudentTarget(
  ctx: MutationCtx,
  userId: Id<"users">,
) {
  const user = await ctx.db.get(userId);
  if (!user || !user.isActive || !isStudentUser(user)) {
    throw new ConvexError("Student not found.");
  }
  return user;
}

export async function deleteSeedBatch(ctx: MutationCtx) {
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
    const [dateBlocks, templateBlocks] = await Promise.all([
      ctx.db.query("schoolDayDateBlocks").take(1000),
      ctx.db.query("schoolDayTemplateBlocks").take(1000),
    ]);
    for (const block of dateBlocks) {
      await ctx.db.delete(block._id);
      deleted.blocks += 1;
    }
    for (const block of templateBlocks) {
      await ctx.db.delete(block._id);
      deleted.blocks += 1;
    }
    if (dateBlocks.length > 0 || templateBlocks.length > 0) return deleted;

    const [overrides, settings, templates] = await Promise.all([
      ctx.db.query("schoolDayDateOverrides").take(500),
      ctx.db.query("schoolScheduleSettings").take(10),
      ctx.db.query("schoolDayTemplates").take(100),
    ]);
    for (const override of overrides) {
      await ctx.db.delete(override._id);
      deleted.blocks += 1;
    }
    for (const setting of settings) {
      await ctx.db.delete(setting._id);
      deleted.blocks += 1;
    }
    for (const template of templates) {
      await ctx.db.delete(template._id);
      deleted.blocks += 1;
    }
    if (overrides.length > 0 || settings.length > 0 || templates.length > 0) {
      return deleted;
    }

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

export async function seedDefaultBlocks(ctx: MutationCtx, actorId: Id<"users">, now: number, scheduleWeekdays: string[], baseBlocks: any[]) {
  let blocksInserted = 0;
  for (const weekday of scheduleWeekdays) {
    for (const block of baseBlocks) {
      const existing = await ctx.db
        .query("schoolDayBlocks")
        .withIndex("by_weekday_and_startTime", (q) =>
          q.eq("weekday", weekday as any).eq("startTime", block.startTime),
        )
        .unique();
      if (existing) continue;
      await ctx.db.insert("schoolDayBlocks", {
        weekday: weekday as any,
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

export async function seedRegularDayTemplate(
  ctx: MutationCtx,
  actorId: Id<"users">,
  now: number,
  inputBlocks: readonly DayBlockInput[],
) {
  const name = "Regular day";
  const existing = await ctx.db
    .query("schoolDayTemplates")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  const templateId = existing?._id ??
    (await ctx.db.insert("schoolDayTemplates", {
      name,
      kind: "REGULAR",
      createdById: actorId,
      createdAt: now,
      updatedAt: now,
    }));
  const existingBlocks = await ctx.db
    .query("schoolDayTemplateBlocks")
    .withIndex("by_templateId_and_position", (q) =>
      q.eq("templateId", templateId),
    )
    .take(25);
  if (existingBlocks.length === 0) {
    for (const block of normalizeDayBlocks([...inputBlocks])) {
      await ctx.db.insert("schoolDayTemplateBlocks", {
        templateId,
        position: block.position,
        label: block.label,
        periodNumber: block.periodNumber ?? undefined,
        startTime: block.startTime,
        endTime: block.endTime,
        createdAt: now,
        updatedAt: now,
      });
    }
  }
  const settings = await ctx.db
    .query("schoolScheduleSettings")
    .withIndex("by_key", (q) => q.eq("key", "default"))
    .unique();
  if (!settings) {
    await ctx.db.insert("schoolScheduleSettings", {
      key: "default",
      regularTemplateId: templateId,
      updatedById: actorId,
      updatedAt: now,
    });
  }
  return templateId;
}

export async function seedAcceptedFriendPairs(
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
