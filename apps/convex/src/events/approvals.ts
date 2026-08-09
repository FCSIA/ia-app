import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { serializeEvent, serializedEventValidator } from "./serialize";
import { deliverMany, eventAudience } from "../notifications/delivery";

export const listPendingForSponsor = query({
  args: {},
  returns: v.array(serializedEventValidator),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const approvals = await ctx.db
      .query("eventApprovals")
      .withIndex("by_sponsorId_and_status", (q) =>
        q.eq("sponsorId", user._id).eq("status", "PENDING"),
      )
      .collect();

    const events = await Promise.all(
      approvals.map(async (approval) => {
        const event = await ctx.db.get(approval.eventId);
        if (!event) return null;
        return serializeEvent(ctx, event);
      }),
    );

    return events.filter((event): event is NonNullable<typeof event> => !!event);
  },
});

export const approveEvent = mutation({
  args: {
    eventId: v.id("events"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const approval = await ctx.db
      .query("eventApprovals")
      .withIndex("by_eventId_and_sponsorId", (q) =>
        q.eq("eventId", args.eventId).eq("sponsorId", user._id),
      )
      .first();

    if (!approval || approval.status !== "PENDING") {
      throw new Error("Approval not found");
    }

    await ctx.db.patch(approval._id, {
      status: "APPROVED",
      note: args.note,
      decidedAt: Date.now(),
    });

    const pending = await ctx.db
      .query("eventApprovals")
      .withIndex("by_eventId_and_status", (q) =>
        q.eq("eventId", args.eventId).eq("status", "PENDING"),
      )
      .collect();

    if (pending.length === 0) {
      const event = await ctx.db.get(args.eventId);
      if (event) {
        await ctx.db.patch(args.eventId, {
          status: "PUBLISHED",
          publishedAt: Date.now(),
          updatedAt: Date.now(),
        });
        const existingCalendar = await ctx.db
          .query("calendarEntries")
          .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
          .first();
        if (!existingCalendar) {
          await ctx.db.insert("calendarEntries", {
            eventId: args.eventId,
            title: event.title,
            description: event.description,
            location: event.location,
            startAt: event.startAt,
            endAt: event.endAt,
            tags: ["event"],
            source: event.clubId ? "CLUB" : "SCHOOL",
            createdById: event.authorId,
            createdAt: Date.now(),
          });
        }
        await deliverMany(ctx, await eventAudience(ctx, event), {
          category: "EVENT",
          title: event.title,
          body: event.description ?? "New event published.",
          href: `/events/${event._id}`,
          subject: {
            kind: "event",
            eventId: event._id,
            ...(event.clubId ? { clubId: event.clubId } : {}),
          },
        });
      }
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "EVENT_APPROVED",
      entityId: args.eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });
    return null;
  },
});

export const rejectEvent = mutation({
  args: {
    eventId: v.id("events"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const approval = await ctx.db
      .query("eventApprovals")
      .withIndex("by_eventId_and_sponsorId", (q) =>
        q.eq("eventId", args.eventId).eq("sponsorId", user._id),
      )
      .first();

    if (!approval || approval.status !== "PENDING") {
      throw new Error("Approval not found");
    }

    await ctx.db.patch(approval._id, {
      status: "DECLINED",
      note: args.note,
      decidedAt: Date.now(),
    });

    await ctx.db.patch(args.eventId, {
      status: "CANCELLED",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "EVENT_REJECTED",
      entityId: args.eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });
    return null;
  },
});
