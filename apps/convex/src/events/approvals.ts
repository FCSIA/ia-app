import { logAuditEvent } from "../audit/_lib";
import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx, type QueryCtx } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { serializeEvent, serializedEventValidator } from "./serialize";
import { createDocLoader } from "../../lib/docLoader";
import { publishEvent } from "./_publish";

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

/**
 * The club's sponsors who can decide its events: those with active accounts.
 * A deactivated sponsor cannot sign in, so an approval waiting on them would
 * never be decided.
 */
export async function activeClubSponsorIds(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
) {
  const sponsors = await ctx.db
    .query("clubSponsors")
    .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
    .collect();
  const users = await Promise.all(sponsors.map((sponsor) => ctx.db.get(sponsor.userId)));
  return [
    ...new Set(sponsors.filter((_, index) => users[index]?.isActive).map((sponsor) => sponsor.userId)),
  ];
}

/**
 * Moves a pending club event on after an approval or a change in who can
 * approve it. Requests waiting on someone who is no longer an active sponsor
 * are dropped. The event publishes once no active sponsor's request is left
 * and someone has approved it. If no one approved it, the club's other active
 * sponsors are asked instead, and the event is cancelled if there are none.
 * Returns whether the event was published.
 */
export async function settlePendingEvent(
  ctx: MutationCtx,
  eventId: Id<"events">,
): Promise<boolean> {
  const event = await ctx.db.get(eventId);
  if (!event || event.status !== "PENDING_APPROVAL" || !event.clubId) return false;
  const clubId = event.clubId;
  const activeSponsors = new Set(await activeClubSponsorIds(ctx, clubId));
  const approvals = await ctx.db
    .query("eventApprovals")
    .withIndex("by_eventId_and_sponsorId", (q) => q.eq("eventId", eventId))
    .collect();

  let waiting = 0;
  for (const approval of approvals) {
    if (approval.status !== "PENDING") continue;
    if (activeSponsors.has(approval.sponsorId)) waiting += 1;
    else await ctx.db.delete(approval._id);
  }
  if (waiting > 0) return false;
  if (approvals.some((approval) => approval.status === "APPROVED")) {
    // Requests left with sponsors who can no longer act are moot now.
    await clearPendingApprovals(ctx, event._id);
    await publishEvent(ctx, event);
    return true;
  }

  const asked = new Set(approvals.map((approval) => approval.sponsorId));
  const replacements = [...activeSponsors].filter((sponsorId) => !asked.has(sponsorId));
  for (const sponsorId of replacements) {
    await ctx.db.insert("eventApprovals", {
      eventId,
      sponsorId,
      status: "PENDING",
      createdAt: Date.now(),
    });
  }
  if (replacements.length > 0) return false;

  // No one is left who could approve it, so it would wait forever.
  await ctx.db.patch(eventId, { status: "CANCELLED", updatedAt: Date.now() });
  await logAuditEvent(ctx, {
    actorId: "system",
    action: "EVENT_CANCELLED",
    entityId: eventId,
    entityType: "EVENT",
    meta: { reason: "NO_ACTIVE_SPONSOR" },
  });
  return false;
}

/**
 * Settles every pending event a sponsor was asked to approve, after they were
 * deactivated or deleted, or stopped sponsoring a club.
 */
export async function settleSponsorApprovals(
  ctx: MutationCtx,
  sponsorId: Id<"users">,
) {
  const pending = await ctx.db
    .query("eventApprovals")
    .withIndex("by_sponsorId_and_status", (q) =>
      q.eq("sponsorId", sponsorId).eq("status", "PENDING"),
    )
    .collect();
  for (const eventId of new Set(pending.map((approval) => approval.eventId))) {
    if (await settlePendingEvent(ctx, eventId)) {
      await logAuditEvent(ctx, {
        actorId: "system",
        action: "EVENT_PUBLISHED",
        entityId: eventId,
        entityType: "EVENT",
        meta: { reason: "REMAINING_SPONSORS_APPROVED" },
      });
    }
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

    // Publishes once every sponsor who can still act has approved.
    await settlePendingEvent(ctx, args.eventId);

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
