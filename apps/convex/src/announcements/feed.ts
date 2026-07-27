import { ConvexError, v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { announcementAudience, deliverMany } from "../notifications/delivery";
import {
  announcementListItemValidator,
  assertCanApproveAnnouncement,
  canViewAnnouncement,
  commentWithAuthorValidator,
  getAccessibleClubIds,
  getViewerAudience,
  isElevatedReader,
} from "./_lib";
import { serializeAnnouncement, serializeComment } from "./serialize";

function isEffectivelyExpired(ann: { status: string; expiresAt?: number }, now: number) {
  return ann.status === "ACTIVE" && !!ann.expiresAt && ann.expiresAt <= now;
}

export const list = query({
  args: {
    archived: v.optional(v.boolean()),
    clubId: v.optional(v.id("clubs")),
    unreadOnly: v.optional(v.boolean()),
  },
  returns: v.array(announcementListItemValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];
    const now = Date.now();

    const viewer = await getViewerAudience(ctx, user._id);
    const accessibleClubIds = await getAccessibleClubIds(ctx, user._id);
    const elevated = isElevatedReader(user.roles);
    const archived = args.archived ?? false;

    let announcements = args.clubId
      ? await ctx.db
          .query("announcements")
          .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
          .order("desc")
          .take(500)
      : await ctx.db
          .query("announcements")
          .withIndex("by_createdAt")
          .order("desc")
          .take(500);

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

    announcements = announcements.filter((ann) => {
      if (isEffectivelyExpired(ann, now)) {
        return archived;
      }
      if (archived) {
        return ["EXPIRED", "ARCHIVED", "REJECTED"].includes(ann.status);
      }
      if (elevated) {
        return (
          (ann.status === "ACTIVE" && !isEffectivelyExpired(ann, now)) ||
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
        !isEffectivelyExpired(ann, now) &&
        canViewAnnouncement(ann, user._id, user.roles, accessibleClubIds, viewer)
      );
    });

    const serialized = await Promise.all(
      announcements.map((ann) => serializeAnnouncement(ctx, ann, user._id)),
    );

    if (!args.unreadOnly) {
      return serialized;
    }

    return serialized.filter((ann) => !ann.isRead);
  },
});

export const get = query({
  args: { announcementId: v.id("announcements") },
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
      announcement: await serializeAnnouncement(ctx, ann, user._id),
      comments: await Promise.all(comments.map((c) => serializeComment(ctx, c))),
    };
  },
});

export const create = mutation({
  args: {
    title: v.string(),
    body: v.string(),
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
  },
  returns: v.id("announcements"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const canPost =
      user.roles.includes("ADMIN") ||
      user.roles.includes("SUPER_ADMIN") ||
      user.roles.includes("TEACHER");
    if (!canPost) throw new ConvexError("Insufficient permissions");

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
      title: args.title.trim(),
      body: args.body.trim(),
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
      submittedById: status === "PENDING_APPROVAL" ? user._id : undefined,
      approvedById: status === "ACTIVE" ? user._id : undefined,
      approvedAt: status === "ACTIVE" ? now : undefined,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "ANNOUNCEMENT_CREATED",
      entityType: "Announcement",
      entityId: annId,
      meta: { title: args.title },
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

    await ctx.db.patch(args.announcementId, {
      status: "REJECTED",
      rejectionNote: args.note,
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
