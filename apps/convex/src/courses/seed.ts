import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { COURSE_SEEDS } from "../seed-data/courses";
import { courseSeedResultValidator, courseSeedToDocument } from "./_lib";

export const run = mutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
  },
  returns: courseSeedResultValidator,
  handler: async (ctx, args) => {
    const expectedSecret = process.env.COURSE_SEED_SECRET ?? process.env.BOOTSTRAP_SECRET;
    if (!expectedSecret || args.secret !== expectedSecret) {
      throw new ConvexError("Invalid seed secret.");
    }

    let deleted = 0;
    if (args.reset) {
      const existing = await ctx.db.query("courses").take(1000);
      for (const course of existing) {
        await ctx.db.delete(course._id);
        deleted += 1;
      }
    }

    let inserted = 0;
    let updated = 0;
    const now = Date.now();

    for (const seed of COURSE_SEEDS) {
      const existing = await ctx.db
        .query("courses")
        .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
        .unique();

      const value = courseSeedToDocument(seed, now);

      if (existing) {
        await ctx.db.patch(existing._id, value);
        updated += 1;
      } else {
        await ctx.db.insert("courses", {
          ...value,
          createdAt: now,
        });
        inserted += 1;
      }
    }

    return { inserted, updated, deleted };
  },
});
