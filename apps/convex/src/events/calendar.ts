import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { calendarSourceValidator } from "../validators";

const MAX_CALENDAR_RANGE_MS = 92 * 24 * 60 * 60 * 1000;

export const list = query({
  args: {
    startDate: v.number(),
    endDate: v.number(),
    sources: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (args.endDate < args.startDate) {
      throw new Error("Calendar end date must be after start date");
    }
    if (args.endDate - args.startDate > MAX_CALENDAR_RANGE_MS) {
      throw new Error("Calendar range cannot exceed 92 days");
    }

    const entries = await ctx.db
      .query("calendarEntries")
      .withIndex("by_startAt", (q) =>
        q.gte("startAt", args.startDate).lte("startAt", args.endDate),
      )
      .collect();

    const requested =
      args.sources && args.sources.length > 0
        ? args.sources
        : ["DISTRICT", "SCHOOL", "CLUB", "PERSONAL", "FLEX_FRIDAY"];

    const allowed = new Set(requested);
    const includePersonal = allowed.has("PERSONAL");

    return entries.filter((entry) => {
      if (!allowed.has(entry.source)) return false;
      if (entry.source === "PERSONAL") {
        return includePersonal && user && entry.createdById === user._id;
      }
      return true;
    });
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
    source: v.optional(calendarSourceValidator),
  },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    const entryId = await ctx.db.insert("calendarEntries", {
      title: args.title.trim(),
      description: args.description?.trim(),
      location: args.location?.trim(),
      startAt: args.startAt,
      endAt: args.endAt,
      tags: args.tags ?? ["personal"],
      source: args.source ?? "PERSONAL",
      createdById: user._id,
      createdAt: Date.now(),
    });

    return entryId;
  },
});

export const remove = mutation({
  args: { entryId: v.id("calendarEntries") },
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const entry = await ctx.db.get(args.entryId);
    if (!entry) throw new Error("Calendar entry not found");

    if (entry.source !== "PERSONAL" || entry.createdById !== user._id) {
      throw new Error("You can only delete your own personal entries");
    }

    await ctx.db.delete(args.entryId);
  },
});
