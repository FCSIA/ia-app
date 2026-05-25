import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import { eventValidator } from "./_lib";

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").order("desc").take(50);
  },
});

export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.eventId);
  },
});

export const create = mutation({
  args: {
    ...eventValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const eventId = await ctx.db.insert("events", {
      ...args,
      authorId: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    
    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "EVENT_CREATED",
      entityId: eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });

    return eventId;
  },
});

export const update = mutation({
  args: {
    eventId: v.id("events"),
    updates: v.object({
      title: v.optional(v.string()),
      description: v.optional(v.string()),
      startAt: v.optional(v.number()),
      endAt: v.optional(v.number()),
      status: v.optional(v.union(
        v.literal("DRAFT"),
        v.literal("PENDING_APPROVAL"),
        v.literal("APPROVED"),
        v.literal("PUBLISHED"),
        v.literal("CANCELLED"),
      )),
    }),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    
    // Authorization logic to be refined based on roles/clubs
    
    await ctx.db.patch(args.eventId, {
      ...args.updates,
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "EVENT_UPDATED",
      entityId: args.eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });
  },
});
