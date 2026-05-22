import { ConvexError, v, type Infer } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import {
  appUserPublicValidator,
  scheduleWeekdayValidator,
  schoolDayBlockKindValidator,
} from "../validators";
import { courseSummaryValidator, toCourseSummary } from "./courses";
import type { AppRole } from "./roles";

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
  course: v.union(courseSummaryValidator, v.null()),
});

export const studentScheduleRecordValidator = v.object({
  id: v.id("studentSchedules"),
  isPublic: v.boolean(),
  entries: v.array(studentScheduleEntryValidator),
});

export const scheduleFriendUserValidator = v.object({
  id: v.id("users"),
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
  friends: v.array(scheduleFriendValidator),
  incomingRequests: v.array(scheduleFriendRequestValidator),
  outgoingRequests: v.array(scheduleFriendRequestValidator),
});

export const scheduleSearchResultValidator = v.object({
  id: v.id("users"),
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
  courseId: v.id("courses"),
});

export type ScheduleBlockPayload = Infer<typeof scheduleBlockPayloadValidator>;
export type ScheduleEntryInput = Infer<typeof scheduleEntryInputValidator>;

const STUDENT_ROLES: AppRole[] = ["STUDENT", "STUDENT_LEADER", "STUDENT_ADMIN"];
const ADMIN_ROLES: AppRole[] = ["ADMIN", "SUPER_ADMIN"];

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
    id: user._id,
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
    const course = await ctx.db.get(entry.courseId);
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

  return {
    id: schedule._id,
    isPublic: schedule.isPublic,
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

export function normalizeScheduleEntries(entries: ScheduleEntryInput[]) {
  const seen = new Set<string>();
  return entries.map((entry) => {
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

export { appUserPublicValidator };
