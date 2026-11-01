import { ConvexError, v } from "convex/values";
import { paginationOptsValidator, paginationResultValidator } from "convex/server";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { announcementAudience, deliverMany } from "../notifications/delivery";
import {
  MAX_ANNOUNCEMENT_BODY_CHARACTERS,
  MAX_ANNOUNCEMENT_REJECTION_NOTE_CHARACTERS,
  MAX_ANNOUNCEMENT_TITLE_CHARACTERS,
  normalizeBoundedText,
  normalizeAnnouncementEmbedUrls,
  normalizeOptionalBoundedText,
} from "./contentValidation";
import {
  announcementListItemValidator,
  assertCanApproveAnnouncement,
  canViewAnnouncement,
  commentWithAuthorValidator,
  getAccessibleClubIds,
  getViewerAudience,
  canPostGlobalAnnouncements,
  isElevatedReader,
} from "./_lib";
import {
  serializeAnnouncement,
  serializeAnnouncements,
  serializeComments,
} from "./serialize";
import { getClubContext } from "../clubs/access";
import { consumeStagedAnnouncementImages } from "../uploads/announcementImages";

function isEffectivelyExpired(ann: { status: string; expiresAt?: number }, now: number) {
  return ann.status === "ACTIVE" && !!ann.expiresAt && ann.expiresAt <= now;
}

export const ANNOUNCEMENT_PAST_AGE_MS = 14 * 24 * 60 * 60 * 1000;

function isPastByAge(ann: { createdAt: number }, now: number) {
  return ann.createdAt <= now - ANNOUNCEMENT_PAST_AGE_MS;
}

export const listPage = query({
  args: {
    archived: v.optional(v.boolean()),
    bookmarkedOnly: v.optional(v.boolean()),
    clubId: v.optional(v.id("clubs")),
    unreadOnly: v.optional(v.boolean()),
    now: v.optional(v.number()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(announcementListItemValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: args.paginationOpts.cursor ?? "" };
    return listForUser(ctx, { ...args, now: args.now ?? Date.now() }, user);
  },
});

export const list = query({
  args: { archived: v.optional(v.boolean()), clubId: v.optional(v.id("clubs")), unreadOnly: v.optional(v.boolean()), now: v.optional(v.number()) },
  returns: v.array(announcementListItemValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    // Compact consumers still use this compatibility endpoint. Keep its
    // previous 500-record window so records removed after authorization and
    // status filtering do not erase an otherwise available feed.
    return (await listForUser(ctx, { ...args, now: args.now ?? Date.now(), paginationOpts: { cursor: null, numItems: 500 } }, user)).page;
  },
});

export const listPinned = query({
  args: { now: v.number(), limit: v.optional(v.number()) },
  returns: v.array(announcementListItemValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    return listPinnedForUser(ctx, user, args.now, args.limit);
  },
});

export const listPinnedPage = query({
  args: {
    now: v.number(),
    bookmarkedOnly: v.optional(v.boolean()),
    readOnly: v.optional(v.boolean()),
    unreadOnly: v.optional(v.boolean()),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(announcementListItemValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: args.paginationOpts.cursor ?? "" };
    const result = await ctx.db.query("announcementPins")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);
    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    const announcements: Doc<"announcements">[] = [];
    for (const pin of result.page) {
      const announcement = await ctx.db.get(pin.announcementId);
      if (!announcement || announcement.status !== "ACTIVE" || isEffectivelyExpired(announcement, args.now) || isPastByAge(announcement, args.now)) continue;
      if (canViewAnnouncement(announcement, user._id, user.roles, accessibleClubIds, viewer)) announcements.push(announcement);
    }
    const serialized = await serializeAnnouncements(ctx, announcements, user._id, args.now);
    return {
      ...result,
      page: serialized.filter((announcement) =>
        (!args.bookmarkedOnly || announcement.isBookmarked) &&
        (!args.readOnly || announcement.isRead) &&
        (!args.unreadOnly || !announcement.isRead),
      ),
    };
  },
});

export const listPastStatusPage = query({
  args: {
    status: v.union(v.literal("ACTIVE"), v.literal("EXPIRED"), v.literal("ARCHIVED"), v.literal("REJECTED")),
    clubId: v.optional(v.id("clubs")),
    now: v.number(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(announcementListItemValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return { page: [], isDone: true, continueCursor: args.paginationOpts.cursor ?? "" };
    const result = args.status === "ACTIVE"
      // The createdAt prefix confines expiration checks to the recent 14-day
      // feed window. An expiresAt-only range would also walk every historical
      // expired ACTIVE row, which the age-based Past stream already covers.
      ? await ctx.db.query("announcements")
          .withIndex("by_status_and_createdAt", (q) => q.eq("status", "ACTIVE").gt("createdAt", args.now - ANNOUNCEMENT_PAST_AGE_MS))
          // Convex orders undefined below numbers, so <= alone includes posts without expiry.
          // https://docs.convex.dev/database/reading-data#ordering
          .filter((q) => q.and(
            q.neq(q.field("expiresAt"), undefined),
            q.lte(q.field("expiresAt"), args.now),
          ))
          .order("desc")
          .paginate(args.paginationOpts)
      : await ctx.db.query("announcements")
          .withIndex("by_status_and_createdAt", (q) => q.eq("status", args.status).gt("createdAt", args.now - ANNOUNCEMENT_PAST_AGE_MS))
          .order("desc")
          .paginate(args.paginationOpts);
    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    const elevated = isElevatedReader(user.roles);
    if (args.clubId) {
      const isSponsor = await ctx.db.query("clubSponsors")
        .withIndex("by_clubId_and_userId", (q) => q.eq("clubId", args.clubId!).eq("userId", user._id))
        .first();
      if (!accessibleClubIds.includes(args.clubId) && !isSponsor && !elevated) throw new ConvexError("Not a club member");
    }
    const visible = result.page.filter((announcement) => {
      if (args.clubId && announcement.clubId !== args.clubId) return false;
      return elevated || announcement.authorId === user._id || canViewAnnouncement(announcement, user._id, user.roles, accessibleClubIds, viewer);
    });
    return { ...result, page: await serializeAnnouncements(ctx, visible, user._id, args.now) };
  },
});

export async function listPinnedForUser(
  ctx: QueryCtx,
  user: Doc<"users">,
  now: number,
  limit = 100,
) {
    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    const pins = await ctx.db.query("announcementPins")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(Math.max(1, Math.min(limit, 500)));
    const announcements: Doc<"announcements">[] = [];
    for (const pin of pins) {
      const announcement = await ctx.db.get(pin.announcementId);
      if (!announcement || announcement.status !== "ACTIVE" || isEffectivelyExpired(announcement, now) || isPastByAge(announcement, now)) continue;
      if (canViewAnnouncement(announcement, user._id, user.roles, accessibleClubIds, viewer)) announcements.push(announcement);
    }
    return serializeAnnouncements(ctx, announcements, user._id, now);
}

type FeedListArgs = { archived?: boolean; bookmarkedOnly?: boolean; clubId?: Id<"clubs">; unreadOnly?: boolean; now: number; paginationOpts: { cursor: string | null; numItems: number; endCursor?: string | null; maximumRowsRead?: number; maximumBytesRead?: number; id?: number } };

export async function listForUser(ctx: QueryCtx, args: FeedListArgs, user: Doc<"users">) {
    const now = args.now;
    const pastCutoff = now - ANNOUNCEMENT_PAST_AGE_MS;

    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    const elevated = isElevatedReader(user.roles);
    const archived = args.archived ?? false;

    const result = args.clubId
      ? archived
        ? await ctx.db.query("announcements").withIndex("by_clubId_and_createdAt", (q) => q.eq("clubId", args.clubId!).lte("createdAt", pastCutoff)).order("desc").paginate(args.paginationOpts)
        : await ctx.db.query("announcements").withIndex("by_clubId_and_createdAt", (q) => q.eq("clubId", args.clubId!).gt("createdAt", pastCutoff))
            .filter((q) => q.or(q.eq(q.field("status"), "ACTIVE"), q.eq(q.field("status"), "PENDING_APPROVAL"), q.and(q.eq(q.field("status"), "REJECTED"), q.eq(q.field("authorId"), user._id))))
            .filter((q) => q.or(q.neq(q.field("status"), "ACTIVE"), q.eq(q.field("expiresAt"), undefined), q.gt(q.field("expiresAt"), now)))
            .order("desc").paginate(args.paginationOpts)
      : archived
        ? await ctx.db.query("announcements").withIndex("by_createdAt", (q) => q.lte("createdAt", pastCutoff)).order("desc").paginate(args.paginationOpts)
        : await ctx.db.query("announcements").withIndex("by_createdAt", (q) => q.gt("createdAt", pastCutoff))
            .filter((q) => q.or(q.eq(q.field("status"), "ACTIVE"), q.eq(q.field("status"), "PENDING_APPROVAL"), q.and(q.eq(q.field("status"), "REJECTED"), q.eq(q.field("authorId"), user._id))))
            .filter((q) => q.or(q.neq(q.field("status"), "ACTIVE"), q.eq(q.field("expiresAt"), undefined), q.gt(q.field("expiresAt"), now)))
            .order("desc").paginate(args.paginationOpts);

    if (args.clubId) {
      const clubId = args.clubId;
      const isMember = accessibleClubIds.includes(clubId);
      const isSponsor = await ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", user._id),
        )
        .first();
      if (!isMember && !isSponsor && !elevated) {
        throw new ConvexError("Not a club member");
      }
    }

    const announcements = result.page.filter((ann) => {
      if (archived) {
        const belongsInPast =
          isPastByAge(ann, now) ||
          isEffectivelyExpired(ann, now) ||
          ["EXPIRED", "ARCHIVED", "REJECTED"].includes(ann.status);
        if (!belongsInPast) return false;
        if (elevated) return true;
        if (
          ann.authorId === user._id &&
          ["PENDING_APPROVAL", "REJECTED"].includes(ann.status)
        ) {
          return true;
        }
        return canViewAnnouncement(ann, user._id, user.roles, accessibleClubIds, viewer);
      }
      if (isPastByAge(ann, now) || isEffectivelyExpired(ann, now)) return false;
      if (elevated) {
        return (
          ann.status === "ACTIVE" ||
          ann.status === "PENDING_APPROVAL" ||
          (ann.authorId === user._id &&
            ["PENDING_APPROVAL", "REJECTED"].includes(ann.status))
        );
      }
      if (
        ann.authorId === user._id &&
        ["PENDING_APPROVAL", "REJECTED"].includes(ann.status)
      ) {
        return true;
      }
      return (
        ann.status === "ACTIVE" &&
        canViewAnnouncement(ann, user._id, user.roles, accessibleClubIds, viewer)
      );
    });

    const serialized = await serializeAnnouncements(ctx, announcements, user._id, now);

    return { ...result, page: serialized.filter((ann) => !args.unreadOnly || !ann.isRead).filter((ann) => !args.bookmarkedOnly || ann.isBookmarked) };
}

export const get = query({
  args: { announcementId: v.id("announcements"), now: v.optional(v.number()) },
  returns: v.union(
    v.object({
      announcement: announcementListItemValidator,
      comments: v.array(commentWithAuthorValidator),
    }),
    v.null(),
  ),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;

    const ann = await ctx.db.get(args.announcementId);
    if (!ann) return null;
    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    if (!canViewAnnouncement(ann, user._id, user.roles, accessibleClubIds, viewer)) {
      return null;
    }

    const comments = await ctx.db
      .query("comments")
      .withIndex("by_announcementId", (q) => q.eq("announcementId", args.announcementId))
      .collect();

    return {
      announcement: await serializeAnnouncement(ctx, ann, user._id, args.now ?? Date.now()),
      comments: await serializeComments(ctx, comments),
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
    bodyMarkdown: v.optional(v.string()),
    targetType: v.union(
      v.literal("SCHOOL_WIDE"),
      v.literal("GRADE"),
      v.literal("PATHWAY"),
      v.literal("CLUB"),
      v.literal("INTERSECTION"),
    ),
    targetGrade: v.optional(v.number()),
    targetGrades: v.array(v.number()),
    targetPathway: v.optional(v.string()),
    targetMajorPathways: v.array(v.string()),
    targetMinorPathways: v.array(v.string()),
    clubId: v.optional(v.id("clubs")),
    allowComments: v.boolean(),
    isAdminGeneral: v.boolean(),
    expiresAt: v.optional(v.number()),
    promoted: v.optional(v.boolean()),
    imageUploadIds: v.optional(v.array(v.id("announcementImageUploads"))),
    embedUrls: v.optional(v.array(v.string())),
  },
  returns: v.id("announcements"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const title = normalizeBoundedText(
      args.title,
      "Announcement title",
      MAX_ANNOUNCEMENT_TITLE_CHARACTERS,
    );
    const body = normalizeBoundedText(
      args.body,
      "Announcement body",
      MAX_ANNOUNCEMENT_BODY_CHARACTERS,
    );
    const bodyMarkdown = args.bodyMarkdown
      ? normalizeBoundedText(
          args.bodyMarkdown,
          "Announcement Markdown",
          MAX_ANNOUNCEMENT_BODY_CHARACTERS,
        )
      : undefined;
    const embedUrls = normalizeAnnouncementEmbedUrls(args.embedUrls);
    const canPostGlobally = canPostGlobalAnnouncements(user.roles);
    const clubContext = args.clubId && !canPostGlobally
      ? await getClubContext(ctx, args.clubId, user)
      : null;
    if (!canPostGlobally && !clubContext?.permissions.createAnnouncementDrafts) {
      throw new ConvexError("You do not have permission to create announcement drafts");
    }

    const isAdmin =
      user.roles.includes("ADMIN") || user.roles.includes("SUPER_ADMIN");

    let status: "ACTIVE" | "PENDING_APPROVAL" = "ACTIVE";
    if (args.clubId) {
      const clubId = args.clubId;
      const isSponsor = await ctx.db
        .query("clubSponsors")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", user._id),
        )
        .first();
      if (!isSponsor && !isAdmin) {
        status = "PENDING_APPROVAL";
      }
    }

    const now = Date.now();
    const promotedUntil =
      args.promoted && isAdmin
        ? now + 30 * 24 * 60 * 60 * 1000
        : undefined;

    const annId = await ctx.db.insert("announcements", {
      authorId: user._id,
      title,
      body,
      bodyMarkdown,
      targetType: args.targetType,
      targetGrade: args.targetGrade,
      targetGrades: args.targetGrades,
      targetPathway: args.targetPathway,
      targetMajorPathways: args.targetMajorPathways,
      targetMinorPathways: args.targetMinorPathways,
      clubId: args.clubId,
      status,
      allowComments: args.allowComments,
      isAdminGeneral: args.isAdminGeneral,
      expiresAt: args.expiresAt,
      promotedUntil,
      embedUrls,
      submittedById: status === "PENDING_APPROVAL" ? user._id : undefined,
      approvedById: status === "ACTIVE" ? user._id : undefined,
      approvedAt: status === "ACTIVE" ? now : undefined,
      commentCount: 0,
      createdAt: now,
      updatedAt: now,
    });

    await consumeStagedAnnouncementImages(ctx, {
      imageUploadIds: args.imageUploadIds ?? [],
      uploaderId: user._id,
      announcementId: annId,
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: annId,
      meta: { title, imageCount: args.imageUploadIds?.length ?? 0, embedCount: embedUrls.length },
    });

    if (status === "ACTIVE") {
      const ann = await ctx.db.get(annId);
      if (ann) {
        await deliverMany(ctx, await announcementAudience(ctx, ann), {
          category: ann.clubId ? "CLUB_ANNOUNCEMENT" : "SCHOOL_ANNOUNCEMENT",
          title: ann.title,
          body: ann.body,
          href: `/announcements/${ann._id}`,
          subject: {
            kind: "announcement",
            announcementId: ann._id,
            ...(ann.clubId ? { clubId: ann.clubId } : {}),
          },
        });
      }
    }

    return annId;
  },
});

export const approve = mutation({
  args: { announcementId: v.id("announcements") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");
    await assertCanApproveAnnouncement(ctx, ann, user);
    if (ann.status !== "PENDING_APPROVAL") {
      throw new ConvexError("Only pending announcements can be approved");
    }

    await ctx.db.patch(args.announcementId, {
      status: "ACTIVE",
      approvedAt: Date.now(),
      approvedById: user._id,
      updatedAt: Date.now(),
    });

    const activeAnn = await ctx.db.get(args.announcementId);
    if (activeAnn) {
      await deliverMany(ctx, await announcementAudience(ctx, activeAnn), {
        category: activeAnn.clubId ? "CLUB_ANNOUNCEMENT" : "SCHOOL_ANNOUNCEMENT",
        title: activeAnn.title,
        body: activeAnn.body,
        href: `/announcements/${activeAnn._id}`,
        subject: {
          kind: "announcement",
          announcementId: activeAnn._id,
          ...(activeAnn.clubId ? { clubId: activeAnn.clubId } : {}),
        },
      });
    }

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_APPROVED",
      entityType: "Announcement",
      entityId: args.announcementId,
    });
  },
});

export const reject = mutation({
  args: {
    announcementId: v.id("announcements"),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    const ann = await ctx.db.get(args.announcementId);
    if (!ann) throw new ConvexError("Announcement not found");
    await assertCanApproveAnnouncement(ctx, ann, user);
    if (ann.status !== "PENDING_APPROVAL") {
      throw new ConvexError("Only pending announcements can be rejected");
    }
    const note = normalizeOptionalBoundedText(
      args.note,
      "Rejection note",
      MAX_ANNOUNCEMENT_REJECTION_NOTE_CHARACTERS,
    );

    await ctx.db.patch(args.announcementId, {
      status: "REJECTED",
      rejectionNote: note,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_REJECTED",
      entityType: "Announcement",
      entityId: args.announcementId,
    });
  },
});
