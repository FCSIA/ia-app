import { eventHref } from "../../../shared/routes";
import { logAuditEvent } from "../audit/_lib";
import { ConvexError, v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { serializeEvent, serializedEventValidator } from "./serialize";
import { createDocLoader } from "../../lib/docLoader";
import { deliverMany, eventAudience } from "../notifications/delivery";

/**
 * Remove the approvals still waiting on a decision once the event has left
 * PENDING_APPROVAL, so other sponsors are not asked to approve a cancelled
 * event. Decided approvals stay as the record of who decided.
 */
export async function clearPendingApprovals(
  ctx: MutationCtx,
  eventId: Id<"events">,
) {
  const pending = await ctx.db
    .query("eventApprovals")
    .withIndex("by_eventId_and_status", (q) =>
      q.eq("eventId", eventId).eq("status", "PENDING"),
    )
    .collect();
  for (const approval of pending) {
    await ctx.db.delete(approval._id);
  }
}

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

    // One loader across the list: pending approvals cluster on a handful of
    // clubs and authors, so those documents are read once instead of per row.
    const loader = createDocLoader(ctx);
    const events = await Promise.all(
      approvals.map(async (approval) => {
        const event = await loader.get(approval.eventId);
        // Approvals left behind by an event that was already decided or
        // cancelled are not actionable.
        if (!event || event.status !== "PENDING_APPROVAL") return null;
        return serializeEvent(ctx, event, loader);
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
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "PENDING_APPROVAL") {
      throw new ConvexError("This event is no longer waiting for approval");
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
        href: eventHref(event._id),
        subject: {
          kind: "event",
          eventId: event._id,
          ...(event.clubId ? { clubId: event.clubId } : {}),
        },
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "EVENT_APPROVED",
      entityId: args.eventId,
      entityType: "EVENT",
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
    const event = await ctx.db.get(args.eventId);
    if (!event || event.status !== "PENDING_APPROVAL") {
      throw new ConvexError("This event is no longer waiting for approval");
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
    await clearPendingApprovals(ctx, args.eventId);

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "EVENT_REJECTED",
      entityId: args.eventId,
      entityType: "EVENT",
    });
    return null;
  },
});
