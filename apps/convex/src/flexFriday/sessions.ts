import { logAuditEvent } from "../audit/_lib";
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { flexSessionTypeValidator } from "../validators";
import {
  canCreateFlexSession,
  canManageExistingFlexSessions,
} from "./permissions";
import { adjustFlexSessionCount } from "./counts";

export const listByFriday = query({
  args: { flexFridayId: v.id("flexFridays") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    return ctx.db
      .query("flexSessions")
      .withIndex("by_flexFridayId", (q) => q.eq("flexFridayId", args.flexFridayId))
      .collect();
  },
});

export const create = mutation({
  args: {
    flexFridayId: v.id("flexFridays"),
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    sessionType: flexSessionTypeValidator,
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!canCreateFlexSession(user.roles)) throw new Error("Unauthorized");

    const friday = await ctx.db.get(args.flexFridayId);
    if (!friday) throw new Error("Flex Friday not found");

    await adjustFlexSessionCount(ctx, args.flexFridayId, 1);
    const sessionId = await ctx.db.insert("flexSessions", {
      flexFridayId: args.flexFridayId,
      title: args.title.trim(),
      description: args.description?.trim(),
      startTime: args.startTime ?? "13:00",
      endTime: args.endTime ?? "14:30",
      sessionType: args.sessionType,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "FLEX_SESSION_CREATED",
      entityId: sessionId,
      entityType: "FLEX_SESSION",
    });

    return sessionId;
  },
});

export const update = mutation({
  args: {
    sessionId: v.id("flexSessions"),
    title: v.optional(v.string()),
    description: v.optional(v.union(v.string(), v.null())),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
    sessionType: v.optional(flexSessionTypeValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!canManageExistingFlexSessions(user.roles)) throw new Error("Unauthorized");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    await ctx.db.patch(args.sessionId, {
      ...(args.title !== undefined ? { title: args.title.trim() } : {}),
      ...(args.description !== undefined
        ? { description: args.description ?? undefined }
        : {}),
      ...(args.startTime !== undefined ? { startTime: args.startTime } : {}),
      ...(args.endTime !== undefined ? { endTime: args.endTime } : {}),
      ...(args.sessionType !== undefined ? { sessionType: args.sessionType } : {}),
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "FLEX_SESSION_UPDATED",
      entityId: args.sessionId,
      entityType: "FLEX_SESSION",
    });
  },
});

export const remove = mutation({
  args: { sessionId: v.id("flexSessions") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!canManageExistingFlexSessions(user.roles)) throw new Error("Unauthorized");

    const session = await ctx.db.get(args.sessionId);
    if (!session) throw new Error("Session not found");

    const links = await ctx.db
      .query("flexWorkshopSessions")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    if (links.length > 0) {
      throw new Error("Remove workshops from this session before deleting it");
    }

    await adjustFlexSessionCount(ctx, session.flexFridayId, -1);
    await ctx.db.delete(args.sessionId);

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "FLEX_SESSION_DELETED",
      entityId: args.sessionId,
      entityType: "FLEX_SESSION",
    });
  },
});
