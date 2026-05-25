import { v } from "convex/values";
import { internalMutation, type MutationCtx } from "./_generated/server";
import { COURSE_SEEDS } from "./seed-data/courses";
import { BASE_BLOCKS, SCHEDULE_WEEKDAYS, buildScheduleCourses, compareStudents, stableScheduleVisibility } from "./seed-data/schedule";
import { seedDefaultBlocks, seedAcceptedFriendPairs, deleteSeedBatch } from "./schedule/_lib";
import { courseSeedToDocument } from "./courses/_lib";
import { isStudentUser } from "./users/_lib";
import { internal } from "./_generated/api";

export const run = internalMutation({
  args: {
    secret: v.string(),
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // NOTE: In production/actual bootstrap, use a proper secret management system.
    // This is a temporary bootstrap/seed path.
    const now = Date.now();
    
    // 1. Reset if requested
    if (args.reset) {
       // Batch delete tables
       await deleteSeedBatch(ctx);
       // Add other deleteBatch calls here...
    }

    // 2. Seed Courses
    for (const seed of COURSE_SEEDS) {
        const existing = await ctx.db
          .query("courses")
          .withIndex("by_slug", (q) => q.eq("slug", seed.slug))
          .unique();
        const value = courseSeedToDocument(seed, now);
        if (existing) {
          await ctx.db.patch(existing._id, value);
        } else {
          await ctx.db.insert("courses", { ...value, createdAt: now });
        }
    }

    // 3. Seed Users/Auth (Better Auth handles this via bootstrap action)
    
    // 4. Seed Schedule
    const users = await ctx.db.query("users").take(5000);
    const students = users
      .filter((u) => u.isActive && isStudentUser(u))
      .sort(compareStudents);
      
    await seedDefaultBlocks(ctx, users[0]._id, now, SCHEDULE_WEEKDAYS, BASE_BLOCKS as any[]);
    await seedAcceptedFriendPairs(ctx, students, now);
    
    // ...
  },
});
