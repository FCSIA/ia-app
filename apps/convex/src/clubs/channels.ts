import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { channelValidator } from "./_lib";

export const list = query({
  args: { clubId: v.id("clubs") },
  returns: v.array(channelValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("channels")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .collect();
  },
});

export const create = mutation({
  args: {
    clubId: v.id("clubs"),
    name: v.string(),
    isPrivate: v.boolean(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("channels", args);
  },
});
