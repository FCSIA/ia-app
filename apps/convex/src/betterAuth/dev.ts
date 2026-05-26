import { mutation } from "./_generated/server";
import { v } from "convex/values";

const tables = ["session", "account", "verification", "user"] as const;

export const clearAuthData = mutation({
  args: {},
  returns: v.record(v.string(), v.number()),
  handler: async (ctx) => {
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
