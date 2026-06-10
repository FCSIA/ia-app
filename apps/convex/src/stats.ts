import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type { MutationCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

const USER_COUNTS_KEY = "user-counts";

function isStudent(user: Pick<Doc<"users">, "isStudent">) {
  return user.isStudent;
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
    updatedAt: Date.now(),
  });
  const created = await ctx.db.get(id);
  if (!created) throw new Error("Failed to initialize user counts.");
  return created;
}

export async function incrementUserCounts(ctx: MutationCtx, user: Pick<Doc<"users">, "isStudent">, delta: 1 | -1) {
  const counts = await ensureUserCounts(ctx);
  const studentDelta = isStudent(user) ? delta : 0;
  const staffDelta = isStudent(user) ? 0 : delta;
  await ctx.db.patch(counts._id, {
    users: Math.max(0, counts.users + delta),
    students: Math.max(0, counts.students + studentDelta),
    staff: Math.max(0, counts.staff + staffDelta),
    updatedAt: Date.now(),
  });
}

export const rebuildUserCounts = internalMutation({
  args: {},
  returns: v.object({
    users: v.number(),
    students: v.number(),
    staff: v.number(),
  }),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").take(5000);
    const counts = {
      users: users.length,
      students: users.filter(isStudent).length,
      staff: users.filter((user) => !isStudent(user)).length,
    };
    const existing = await ensureUserCounts(ctx);
    await ctx.db.patch(existing._id, {
      ...counts,
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
    };
  },
});
