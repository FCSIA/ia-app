import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";

type BootstrapSeedResult = {
  deleted: number;
  upserted: number;
  nextCursor: string | null;
  isDone: boolean;
};

export const resetAndSeed = mutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    deleted: v.number(),
    upserted: v.number(),
    nextCursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args): Promise<BootstrapSeedResult> => {
    return await ctx.runMutation(internal.seed.run, {
      secret: args.secret,
      reset: args.reset ?? true,
      cursor: args.cursor,
      batchSize: args.batchSize,
    });
  },
});
