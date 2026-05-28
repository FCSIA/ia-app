import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { serializeEvent, serializeEventDetail } from "./serialize";

const ADMIN_ROLES = ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "STUDENT_ADMIN"] as const;

function isAdmin(user: { roles: string[] } | null) {
  if (!user) return false;
  return user.roles.some((role) =>
    (ADMIN_ROLES as readonly string[]).includes(role),
  );
}

export const list = query({
  args: { clubId: v.optional(v.id("clubs")) },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    const admin = isAdmin(user);

    let events = await ctx.db.query("events").order("desc").take(200);

    if (args.clubId) {
      events = events.filter((event) => event.clubId === args.clubId);
    }
    if (!admin) {
      events = events.filter((event) => event.status === "PUBLISHED");
    }

    events.sort((a, b) => a.startAt - b.startAt);

    return Promise.all(events.map((event) => serializeEvent(ctx, event)));
  },
});

export const get = query({
  args: { eventId: v.id("events") },
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
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
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const admin = isAdmin(user);

    let isSponsor = false;
    let hasClubRole = false;
    if (args.clubId) {
      const sponsors = await ctx.db
        .query("clubSponsors")
        .filter((q) => q.eq(q.field("clubId"), args.clubId))
        .collect();
      const members = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId!))
        .filter((q) => q.eq(q.field("userId"), user._id))
        .first();
      isSponsor = sponsors.some((s) => s.userId === user._id);
      hasClubRole = !!members?.role;
    }

    const canCreate = admin || isSponsor || hasClubRole || !args.clubId;
    if (!canCreate) {
      throw new Error("Insufficient permissions to create this event");
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
    }

    if (args.clubId && status === "PENDING_APPROVAL") {
      const sponsors = await ctx.db
        .query("clubSponsors")
        .filter((q) => q.eq(q.field("clubId"), args.clubId))
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
  },
});
