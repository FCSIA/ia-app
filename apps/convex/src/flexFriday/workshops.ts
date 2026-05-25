import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { flexWorkshopValidator } from "./_lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("flexWorkshops").order("desc").take(50);
  },
});

export const create = mutation({
  args: {
    ...flexWorkshopValidator,
    sessionIds: v.array(v.id("flexSessions")),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    // Auth: Teachers and Admins can create workshops
    if (!user.roles.includes("TEACHER") && !user.roles.includes("ADMIN") && !user.roles.includes("SUPER_ADMIN")) {
      throw new Error("Unauthorized");
    }

    const { sessionIds, ...workshopArgs } = args;

    const workshopId = await ctx.db.insert("flexWorkshops", {
      ...workshopArgs,
      teacherId: workshopArgs.teacherId || user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    for (const sessionId of sessionIds) {
      await ctx.db.insert("flexWorkshopSessions", {
        workshopId,
        sessionId,
        createdAt: Date.now(),
      });
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "FLEX_WORKSHOP_CREATED",
      entityId: workshopId,
      entityType: "FLEX_WORKSHOP",
      createdAt: Date.now(),
    });

    return workshopId;
  },
});
