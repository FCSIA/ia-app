import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { clubValidator, memberValidator } from "./_lib";

export const list = query({
  args: {},
  returns: v.array(clubValidator),
  handler: async (ctx) => {
    return await ctx.db.query("clubs").collect();
  },
});

export const getMembers = query({
  args: { clubId: v.id("clubs") },
  returns: v.array(memberValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .collect();
  },
});

export const join = mutation({
  args: { clubId: v.id("clubs") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await ctx.db.insert("clubMembers", {
      clubId: args.clubId,
      userId: user._id,
      role: "MEMBER",
    });
  },
});
