import { mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { v } from "convex/values";

const tables = ["session", "account", "verification", "user"] as const;
const MAX_AUTH_RECORDS_PER_USER = 100;

// These component mutations are callable only from the parent app, and the
// parent must also present a deployment-specific maintenance capability. Keep
// this guard even if component exports or routing change in the future.
function assertMaintenanceSecret(value: string) {
  const expected = process.env.BETTER_AUTH_MAINTENANCE_SECRET;
  if (!expected || value.length < 32 || value !== expected) throw new Error("Auth maintenance is disabled");
}

export const clearAuthData = mutation({
  args: { maintenanceSecret: v.string() },
  returns: v.record(v.string(), v.number()),
  handler: async (ctx, args) => {
    assertMaintenanceSecret(args.maintenanceSecret);
    const deleted: Record<string, number> = {};

    for (const table of tables) {
      const docs = await ctx.db.query(table).collect();

      for (const doc of docs) {
        await ctx.db.delete(doc._id);
      }

      deleted[table] = docs.length;
    }

    return deleted;
  },
});

export const deleteUserData = mutation({
  args: {
    userId: v.string(),
    maintenanceSecret: v.string(),
  },
  returns: v.object({
    accounts: v.number(),
    sessions: v.number(),
    user: v.boolean(),
  }),
  handler: async (ctx, args) => {
    assertMaintenanceSecret(args.maintenanceSecret);
    const [sessions, accounts] = await Promise.all([
      ctx.db
        .query("session")
        .withIndex("userId", (q) => q.eq("userId", args.userId))
        .take(MAX_AUTH_RECORDS_PER_USER + 1),
      ctx.db
        .query("account")
        .withIndex("userId", (q) => q.eq("userId", args.userId))
        .take(MAX_AUTH_RECORDS_PER_USER + 1),
    ]);

    if (
      sessions.length > MAX_AUTH_RECORDS_PER_USER ||
      accounts.length > MAX_AUTH_RECORDS_PER_USER
    ) {
      throw new Error("User has too many auth records to delete in one request.");
    }

    for (const session of sessions) {
      await ctx.db.delete(session._id);
    }
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    const user = await ctx.db.get(args.userId as Id<"user">);
    if (user) {
      await ctx.db.delete(user._id);
    }

    return {
      accounts: accounts.length,
      sessions: sessions.length,
      user: !!user,
    };
  },
});
