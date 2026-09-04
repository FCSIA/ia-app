import { v } from "convex/values";
import { internal } from "../_generated/api";
import { internalMutation } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { adjustClubCounts } from "./counts";

const CLUB_DELETION_BATCH_SIZE = 25;

function hasFullBatch(rows: readonly unknown[]) {
  return rows.length === CLUB_DELETION_BATCH_SIZE;
}

export const cleanupDeletedAnnouncement = internalMutation({
  args: { announcementId: v.id("announcements") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const [comments, reads, bookmarks] = await Promise.all([
      ctx.db
        .query("comments")
        .withIndex("by_announcementId", (q) =>
          q.eq("announcementId", args.announcementId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("announcementReads")
        .withIndex("by_announcementId", (q) =>
          q.eq("announcementId", args.announcementId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("announcementBookmarks")
        .withIndex("by_announcementId_and_userId", (q) =>
          q.eq("announcementId", args.announcementId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
    ]);

    for (const row of [...comments, ...reads, ...bookmarks]) {
      await ctx.db.delete(row._id);
    }

    if ([comments, reads, bookmarks].some(hasFullBatch)) {
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedAnnouncement,
        args,
      );
    }
    return null;
  },
});

export const cleanupDeletedEvent = internalMutation({
  args: { eventId: v.id("events") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const [approvals, calendarEntries] = await Promise.all([
      ctx.db
        .query("eventApprovals")
        .withIndex("by_eventId_and_sponsorId", (q) =>
          q.eq("eventId", args.eventId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("calendarEntries")
        .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
        .take(CLUB_DELETION_BATCH_SIZE),
    ]);

    for (const row of [...approvals, ...calendarEntries]) {
      await ctx.db.delete(row._id);
    }

    if ([approvals, calendarEntries].some(hasFullBatch)) {
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedEvent,
        args,
      );
    }
    return null;
  },
});

export const cleanupDeletedTag = internalMutation({
  args: { tagId: v.id("clubTags") },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const members = await ctx.db
      .query("clubTagMembers")
      .withIndex("by_tagId", (q) => q.eq("tagId", args.tagId))
      .take(CLUB_DELETION_BATCH_SIZE);

    for (const member of members) await ctx.db.delete(member._id);

    if (hasFullBatch(members)) {
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedTag,
        args,
      );
    }
    return null;
  },
});

export const cleanupDeletedClub = internalMutation({
  args: {
    clubId: v.id("clubs"),
    actorId: v.id("users"),
    clubName: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const club = await ctx.db.get(args.clubId);
    if (!club) return null;

    const [
      members,
      unitMembers,
      units,
      sponsors,
      invites,
      joinRequests,
      peopleGroups,
      peopleGroupRules,
      channels,
      tags,
      announcements,
      events,
    ] = await Promise.all([
      ctx.db
        .query("clubMembers")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubUnitMembers")
        .withIndex("by_clubId_and_unitId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubUnits")
        .withIndex("by_clubId_and_isActive_and_position", (q) =>
          q.eq("clubId", args.clubId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubInvites")
        .withIndex("by_clubId_and_recipientId", (q) =>
          q.eq("clubId", args.clubId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubJoinRequests")
        .withIndex("by_clubId_and_status", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubPeopleGroups")
        .withIndex("by_clubId_and_position", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubPeopleGroupRules")
        .withIndex("by_clubId_and_groupId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubChannels")
        .withIndex("by_clubId_and_visibility", (q) =>
          q.eq("clubId", args.clubId),
        )
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("clubTags")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("announcements")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
      ctx.db
        .query("events")
        .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
        .take(CLUB_DELETION_BATCH_SIZE),
    ]);

    // Before the rows go: the club document outlives the drain by design — it
    // is deleted only once every batch comes back short — so its counters
    // follow the rows down rather than sitting stale for the duration.
    await adjustClubCounts(ctx, args.clubId, {
      members: -members.length,
      channels: -channels.length,
    });

    for (const row of [
      ...members,
      ...unitMembers,
      ...units,
      ...sponsors,
      ...invites,
      ...joinRequests,
      ...peopleGroups,
      ...peopleGroupRules,
    ]) {
      await ctx.db.delete(row._id);
    }

    for (const channel of channels) {
      await ctx.db.delete(channel._id);
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.channelDeletion.cleanupDeletedChannel,
        { channelId: channel._id },
      );
    }

    for (const tag of tags) {
      await ctx.db.delete(tag._id);
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedTag,
        { tagId: tag._id },
      );
    }
    for (const announcement of announcements) {
      await ctx.db.delete(announcement._id);
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedAnnouncement,
        { announcementId: announcement._id },
      );
    }
    for (const event of events) {
      await ctx.db.delete(event._id);
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedEvent,
        { eventId: event._id },
      );
    }

    const batches = [
      members,
      unitMembers,
      units,
      sponsors,
      invites,
      joinRequests,
      peopleGroups,
      peopleGroupRules,
      channels,
      tags,
      announcements,
      events,
    ];
    if (batches.some(hasFullBatch)) {
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.clubDeletion.cleanupDeletedClub,
        args,
      );
      return null;
    }

    for (const storageId of [club.logoStorageId, club.bannerStorageId]) {
      if (storageId) await ctx.storage.delete(storageId).catch(() => {});
    }
    await ctx.db.delete(club._id);
    await logAuditEvent(ctx, {
      actorId: args.actorId,
      action: "CLUB_DELETED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { name: args.clubName },
    });
    return null;
  },
});
