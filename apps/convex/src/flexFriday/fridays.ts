import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { flexFridayValidator, flexSessionValidator } from "./_lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("flexFridays").order("desc").take(50);
  },
});

export const create = mutation({
  args: {
    ...flexFridayValidator,
    sessions: v.array(v.object({
      title: v.string(),
      description: v.optional(v.string()),
      startTime: v.string(),
      endTime: v.string(),
      sessionType: v.union(v.literal("STUDENT_CHOICE"), v.literal("MANDATORY_ASSEMBLY"), v.literal("TEACHER_ASSIGNED")),
    })),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    // Admins only
    if (!user.roles.includes("ADMIN") && !user.roles.includes("SUPER_ADMIN")) {
      throw new Error("Unauthorized");
    }

    const { sessions, ...fridayArgs } = args;

    const fridayId = await ctx.db.insert("flexFridays", {
      ...fridayArgs,
      createdAt: Date.now(),
    });

    for (const session of sessions) {
      await ctx.db.insert("flexSessions", {
        flexFridayId: fridayId,
        ...session,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_FRIDAY_CREATED",
      entityId: fridayId,
      entityType: "FLEX_FRIDAY",
      createdAt: Date.now(),
    });

    return fridayId;
  },
});
