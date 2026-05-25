import { ConvexError, v } from "convex/values";
import { mutation } from "../_generated/server";
import { getCurrentAppUser } from "../lib/currentUser";
import {
  requireScheduleAdmin,
  normalizeBlockInput,
  validateBlockConflicts,
  serializeBlock,
  schoolDayBlockValidator,
} from "./lib";
import { logAuditEvent } from "../audit/lib";
import { scheduleWeekdayValidator, schoolDayBlockKindValidator } from "../validators";

export const createBlock = mutation({
  args: {
    weekday: scheduleWeekdayValidator,
    kind: schoolDayBlockKindValidator,
    periodNumber: v.optional(v.number()),
    label: v.optional(v.string()),
    startTime: v.string(),
    endTime: v.string(),
  },
  returns: schoolDayBlockValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const normalized = await normalizeBlockInput(args);
    await validateBlockConflicts(ctx, normalized);
    const now = Date.now();
    const id = await ctx.db.insert("schoolDayBlocks", {
      weekday: normalized.weekday,
      label: normalized.label,
      periodNumber: normalized.periodNumber,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      createdById: user._id,
      createdAt: now,
      updatedAt: now,
    });
    const block = await ctx.db.get(id);
    if (!block) throw new ConvexError("Block not found.");
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayBlock.created",
      entityType: "schoolDayBlock",
      entityId: id,
      meta: { weekday: block.weekday, label: block.label },
    });
    return serializeBlock(block);
  },
});

export const updateBlock = mutation({
  args: {
    blockId: v.id("schoolDayBlocks"),
    weekday: v.optional(scheduleWeekdayValidator),
    kind: v.optional(schoolDayBlockKindValidator),
    periodNumber: v.optional(v.number()),
    label: v.optional(v.string()),
    startTime: v.optional(v.string()),
    endTime: v.optional(v.string()),
  },
  returns: schoolDayBlockValidator,
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const existing = await ctx.db.get(args.blockId);
    if (!existing) throw new ConvexError("Block not found.");
    const normalized = await normalizeBlockInput(args, existing);
    await validateBlockConflicts(ctx, normalized, args.blockId);
    await ctx.db.patch(args.blockId, {
      weekday: normalized.weekday,
      label: normalized.label,
      periodNumber: normalized.periodNumber,
      startTime: normalized.startTime,
      endTime: normalized.endTime,
      updatedAt: Date.now(),
    });
    const block = await ctx.db.get(args.blockId);
    if (!block) throw new ConvexError("Block not found.");
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayBlock.updated",
      entityType: "schoolDayBlock",
      entityId: block._id,
      meta: { weekday: block.weekday, label: block.label },
    });
    return serializeBlock(block);
  },
});

export const deleteBlock = mutation({
  args: { blockId: v.id("schoolDayBlocks") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireScheduleAdmin(user);
    const block = await ctx.db.get(args.blockId);
    if (!block) throw new ConvexError("Block not found.");
    await ctx.db.delete(args.blockId);
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "schoolDayBlock.deleted",
      entityType: "schoolDayBlock",
      entityId: args.blockId,
      meta: { weekday: block.weekday, label: block.label },
    });
    return { success: true };
  },
});
