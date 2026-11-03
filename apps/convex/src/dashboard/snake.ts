import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { displayName } from "../../../shared/user-name";

const mode = v.union(v.literal("small"), v.literal("medium"), v.literal("large"), v.literal("extra-large"));
const limits = { small: 77, medium: 157, large: 237, "extra-large": 381 } as const;

export const leaderboard = query({
  args: { mode },
  returns: v.array(v.object({ name: v.string(), score: v.number(), isYou: v.boolean() })),
  handler: async (ctx, args) => {
    const viewer = await getCurrentAppUser(ctx);
    const scores = await ctx.db.query("snakeScores").withIndex("by_mode_score", q => q.eq("mode", args.mode)).order("desc").take(10);
    const users = await Promise.all(scores.map(score => ctx.db.get(score.userId)));
    return scores.flatMap((score, i) => {
      const user = users[i];
      return user?.isActive ? [{ name: displayName(user), score: score.score, isYou: user._id === viewer._id }] : [];
    });
  },
});

export const submit = mutation({
  args: { mode, score: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!Number.isInteger(args.score) || args.score < 1 || args.score > limits[args.mode]) throw new ConvexError("Invalid score");
    const existing = await ctx.db.query("snakeScores").withIndex("by_user_mode", q => q.eq("userId", user._id).eq("mode", args.mode)).unique();
    if (!existing) await ctx.db.insert("snakeScores", { userId: user._id, mode: args.mode, score: args.score });
    else if (args.score > existing.score) await ctx.db.patch(existing._id, { score: args.score });
    return null;
  },
});
