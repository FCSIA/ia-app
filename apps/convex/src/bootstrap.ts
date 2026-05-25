import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

export const resetAndSeed = mutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.seed.run, {
      secret: args.secret,
      reset: args.reset ?? true,
    });
    return null;
  },
});
