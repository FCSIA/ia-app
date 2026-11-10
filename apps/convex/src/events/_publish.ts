import { eventHref } from "../../../shared/routes";
import type { Doc } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { deliverMany, eventAudience } from "../notifications/delivery";

/**
 * Makes an event public: marks it published, mirrors it onto the calendar
 * (once) and tells everyone it concerns.
 */
export async function publishEvent(ctx: MutationCtx, event: Doc<"events">) {
  if (event.status !== "PUBLISHED") {
    await ctx.db.patch(event._id, {
      status: "PUBLISHED",
      publishedAt: Date.now(),
      updatedAt: Date.now(),
    });
  }

  const existingCalendar = await ctx.db
    .query("calendarEntries")
    .withIndex("by_eventId", (q) => q.eq("eventId", event._id))
    .first();
  if (!existingCalendar) {
    await ctx.db.insert("calendarEntries", {
      eventId: event._id,
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
