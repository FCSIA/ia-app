import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser } from "../../lib/currentUser";
import { serializeEvent, serializeEventDetail, serializedEventDetailValidator, serializedEventValidator } from "./serialize";
import { deliverMany, eventAudience } from "../notifications/delivery";
import { getClubContext } from "../clubs/access";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "STUDENT_ADMIN"] as const;

function isAdmin(user: { roles: string[] } | null) {
  if (!user) return false;
  return user.roles.some((role) =>
    (ADMIN_ROLES as readonly string[]).includes(role),
  );
}

export const list = query({
  args: { clubId: v.optional(v.id("clubs")) },
  returns: v.array(serializedEventValidator),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const admin = isAdmin(user);

    let events = args.clubId
      ? admin
        ? await ctx.db
            .query("events")
            .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
            .take(200)
        : await ctx.db
            .query("events")
            .withIndex("by_clubId_and_status", (q) =>
              q.eq("clubId", args.clubId).eq("status", "PUBLISHED"),
            )
            .take(200)
      : admin
        ? await ctx.db.query("events").withIndex("by_startAt").order("desc").take(200)
        : await ctx.db
            .query("events")
            .withIndex("by_status_and_startAt", (q) => q.eq("status", "PUBLISHED"))
            .order("desc")
            .take(200);

    events.sort((a, b) => a.startAt - b.startAt);

    return Promise.all(events.map((event) => serializeEvent(ctx, event)));
  },
});

export const get = query({
  args: { eventId: v.id("events") },
  returns: v.union(serializedEventDetailValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) return null;

    const admin = isAdmin(user);
    if (
      event.status !== "PUBLISHED" &&
      !admin &&
      event.authorId !== user?._id
    ) {
      return null;
    }

    return serializeEventDetail(ctx, event);
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    location: v.optional(v.string()),
    startAt: v.number(),
    endAt: v.optional(v.number()),
    clubId: v.optional(v.id("clubs")),
  },
  returns: v.id("events"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const admin = isAdmin(user);
    const canCreateGeneral = admin;

    if (!args.clubId && !canCreateGeneral) {
      throw new ConvexError("Insufficient permissions to create general events");
    }

    let isSponsor = false;
    let canCreateClubEvent = false;
    if (args.clubId && !canCreateGeneral) {
      const clubId = args.clubId;
      const context = await getClubContext(ctx, clubId, user);
      isSponsor = context.isSponsor;
      canCreateClubEvent = context.permissions.createEvents;
    }

    const canCreate = canCreateGeneral || canCreateClubEvent;
    if (!canCreate) {
      throw new ConvexError("Insufficient permissions to create this event");
    }

    const status =
      admin || isSponsor || !args.clubId ? "PUBLISHED" : "PENDING_APPROVAL";

    const eventId = await ctx.db.insert("events", {
      authorId: user._id,
      clubId: args.clubId,
      categoryId: undefined,
      status,
      type: args.clubId ? "CLUB" : "GENERAL",
      title: args.title.trim(),
      description: args.description?.trim(),
      location: args.location?.trim(),
      flyerUrl: undefined,
      startAt: args.startAt,
      endAt: args.endAt,
      registrationOpensAt: undefined,
      registrationClosesAt: undefined,
      allowedMajorPathways: [],
      allowedMinorPathways: [],
      requiredMajorWorkshopCount: 0,
      isInactive: false,
      deactivatedAt: undefined,
      publishedAt: status === "PUBLISHED" ? Date.now() : undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    if (status === "PUBLISHED") {
      await ctx.db.insert("calendarEntries", {
        eventId,
        title: args.title.trim(),
        description: args.description?.trim(),
        location: args.location?.trim(),
        startAt: args.startAt,
        endAt: args.endAt,
        tags: ["event"],
        source: args.clubId ? "CLUB" : "SCHOOL",
        createdById: user._id,
        createdAt: Date.now(),
      });
      const event = await ctx.db.get(eventId);
      if (event) {
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

    if (args.clubId && status === "PENDING_APPROVAL") {
      const clubId = args.clubId;
      const sponsors = await ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
        .collect();
      for (const sponsor of sponsors) {
        await ctx.db.insert("eventApprovals", {
          eventId,
          sponsorId: sponsor.userId,
          status: "PENDING",
          createdAt: Date.now(),
        });
      }
    }

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

export const cancel = mutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const event = await ctx.db.get(args.eventId);
    if (!event) throw new Error("Event not found");

    const admin = isAdmin(user);
    if (event.authorId !== user._id && !admin) {
      throw new Error("Cannot cancel this event");
    }

    await ctx.db.patch(args.eventId, {
      status: "CANCELLED",
      updatedAt: Date.now(),
    });

    const calendarRows = await ctx.db
      .query("calendarEntries")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .collect();
    for (const row of calendarRows) {
      await ctx.db.delete(row._id);
    }

    await ctx.db.insert("auditEvents", {
      actorId: user._id,
      action: "EVENT_CANCELLED",
      entityId: args.eventId,
      entityType: "EVENT",
      createdAt: Date.now(),
    });
    return null;
  },
});
