import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const USER_COUNTS_KEY = "user-counts";

type CountedUser = Pick<
  Doc<"users">,
  "isStudent" | "isTeacherStaff" | "isStudentAdmin" | "isOtherRole"
>;

export type UserRoleGroup = "all" | "students" | "teachers" | "student-admin" | "other";

function userCountDeltas(user: CountedUser, delta: 1 | -1) {
  return {
    users: delta,
    students: user.isStudent ? delta : 0,
    staff: user.isStudent ? 0 : delta,
    teachers: user.isTeacherStaff ? delta : 0,
    studentAdmins: user.isStudentAdmin ? delta : 0,
    other: user.isOtherRole ? delta : 0,
  };
}

function clampCount(value: number) {
  return Math.max(0, value);
}

async function ensureUserCounts(ctx: MutationCtx) {
  const existing = await ctx.db
    .query("appStats")
    .withIndex("by_key", (q) => q.eq("key", USER_COUNTS_KEY))
    .unique();
  if (existing) return existing;

  const id = await ctx.db.insert("appStats", {
    key: USER_COUNTS_KEY,
    users: 0,
    students: 0,
    staff: 0,
    teachers: 0,
    studentAdmins: 0,
    other: 0,
    roleGroupCountsReady: true,
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to initialize user counts.");
  return created;
}

export async function incrementUserCounts(
  ctx: MutationCtx,
  user: CountedUser,
  delta: 1 | -1,
) {
  const counts = await ensureUserCounts(ctx);
  const change = userCountDeltas(user, delta);
  await ctx.db.patch(counts._id, {
    users: clampCount(counts.users + change.users),
    students: clampCount(counts.students + change.students),
    staff: clampCount(counts.staff + change.staff),
    ...(counts.roleGroupCountsReady
      ? {
          teachers: clampCount((counts.teachers ?? 0) + change.teachers),
          studentAdmins: clampCount((counts.studentAdmins ?? 0) + change.studentAdmins),
          other: clampCount((counts.other ?? 0) + change.other),
        }
      : {}),
    updatedAt: Date.now(),
  });
}

export async function replaceUserCounts(
  ctx: MutationCtx,
  previous: CountedUser,
  next: CountedUser,
) {
  const counts = await ensureUserCounts(ctx);
  const before = userCountDeltas(previous, -1);
  const after = userCountDeltas(next, 1);
  await ctx.db.patch(counts._id, {
    users: clampCount(counts.users + before.users + after.users),
    students: clampCount(counts.students + before.students + after.students),
    staff: clampCount(counts.staff + before.staff + after.staff),
    ...(counts.roleGroupCountsReady
      ? {
          teachers: clampCount((counts.teachers ?? 0) + before.teachers + after.teachers),
          studentAdmins: clampCount(
            (counts.studentAdmins ?? 0) + before.studentAdmins + after.studentAdmins,
          ),
          other: clampCount((counts.other ?? 0) + before.other + after.other),
        }
      : {}),
    updatedAt: Date.now(),
  });
}

export async function getStoredUserCount(
  ctx: QueryCtx,
  roleGroup: UserRoleGroup,
) {
  const counts = await ctx.db
    .query("appStats")
    .withIndex("by_key", (q) => q.eq("key", USER_COUNTS_KEY))
    .unique();
  if (!counts) return null;
  if (
    !counts.roleGroupCountsReady &&
    ["teachers", "student-admin", "other"].includes(roleGroup)
  ) {
    return null;
  }
  const count = {
    all: counts.users,
    students: counts.students,
    teachers: counts.teachers,
    "student-admin": counts.studentAdmins,
    other: counts.other,
  }[roleGroup];
  return count ?? null;
}

export const rebuildUserCounts = internalMutation({
  args: {},
  returns: v.object({
    users: v.number(),
    students: v.number(),
    staff: v.number(),
    teachers: v.number(),
    studentAdmins: v.number(),
    other: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(5000);
    const counts = {
      users: users.length,
      students: users.filter((user) => user.isStudent).length,
      staff: users.filter((user) => !user.isStudent).length,
      teachers: users.filter((user) => user.isTeacherStaff).length,
      studentAdmins: users.filter((user) => user.isStudentAdmin).length,
      other: users.filter((user) => user.isOtherRole).length,
    };
    const existing = await ensureUserCounts(ctx);
    await ctx.db.patch(existing._id, {
      ...counts,
      roleGroupCountsReady: true,
      updatedAt: Date.now(),
    });
    return counts;
  },
});

export const getUserCounts = internalQuery({
  args: {},
  returns: v.object({
    users: v.number(),
    students: v.number(),
    staff: v.number(),
    teachers: v.number(),
    studentAdmins: v.number(),
    other: v.number(),
  }),
  handler: async (ctx) => {
    const counts = await ctx.db
      .query("appStats")
      .withIndex("by_key", (q) => q.eq("key", USER_COUNTS_KEY))
      .unique();
    return {
      users: counts?.users ?? 0,
      students: counts?.students ?? 0,
      staff: counts?.staff ?? 0,
      teachers: counts?.teachers ?? 0,
      studentAdmins: counts?.studentAdmins ?? 0,
      other: counts?.other ?? 0,
    };
  },
});
