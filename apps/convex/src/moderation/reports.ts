import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole, requireAnyRoleSafe } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { docs } from "../../lib/docs";
import { activeAdmins, deliverMany } from "../notifications/delivery";
import { assertAnnouncementAccess } from "../announcements/_lib";
import { canReadChannel, getViewerContext } from "../clubs/access";

const userRefValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
});

const reportValidator = docs.moderationReports.extend({
  submitter: v.union(userRefValidator, v.null()),
  reportedUser: v.union(userRefValidator, v.null()),
  club: v.union(
    v.object({
      _id: v.id("clubs"),
      name: v.string(),
    }),
    v.null(),
  ),
});

const moderationReportStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("RESOLVED"),
  v.literal("DISMISSED"),
);

async function serializeReport(ctx: QueryCtx, report: Doc<"moderationReports">) {
  const submitter = await ctx.db.get(report.submitterId);
  const reportedUser = report.reportedUserId
    ? await ctx.db.get(report.reportedUserId)
    : null;
  const club = report.clubId ? await ctx.db.get(report.clubId) : null;

  return {
    ...report,
    submitter: submitter
      ? {
          _id: submitter._id,
          firstName: submitter.firstName,
          lastName: submitter.lastName,
        }
      : null,
    reportedUser: reportedUser
      ? {
          _id: reportedUser._id,
          firstName: reportedUser.firstName,
          lastName: reportedUser.lastName,
        }
      : null,
    club: club ? { _id: club._id, name: club.name } : null,
  };
}

type ReportTargetCtx = QueryCtx | MutationCtx;

async function validateReportTarget(
  ctx: ReportTargetCtx,
  user: Doc<"users">,
  args: {
    contentType: string;
    contentId: string;
    reportedUserId?: Id<"users">;
    clubId?: Id<"clubs">;
  },
) {
  if (args.contentType === "CLUB_CHANNEL_MESSAGE") {
    const messageId = ctx.db.normalizeId("clubChannelMessages", args.contentId);
    if (!messageId) throw new ConvexError("Report target not found");
    const message = await ctx.db.get(messageId);
    if (!message) throw new ConvexError("Report target not found");
    const channel = await ctx.db.get(message.channelId);
    if (!channel) throw new ConvexError("Report target not found");
    if (args.clubId && args.clubId !== channel.clubId) {
      throw new ConvexError("Report target does not belong to this club");
    }
    const context = await getViewerContext(ctx, channel.clubId, user);
    const memberships = await ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId_and_userId", (q) => q.eq("channelId", channel._id))
      .collect();
    if (!canReadChannel({ ...channel, memberships }, context, user._id)) {
      throw new ConvexError("Not authorized to report this content");
    }
    if (args.reportedUserId && args.reportedUserId !== message.authorId) {
      throw new ConvexError("Reported user does not match the content author");
    }
    return { clubId: channel.clubId, reportedUserId: message.authorId };
  }

  if (args.contentType === "ANNOUNCEMENT") {
    const announcementId = ctx.db.normalizeId("announcements", args.contentId);
    if (!announcementId) throw new ConvexError("Report target not found");
    const announcement = await ctx.db.get(announcementId);
    if (!announcement) throw new ConvexError("Report target not found");
    await assertAnnouncementAccess(ctx, announcement, user._id, user.roles);
    if (args.clubId && announcement.clubId !== args.clubId) {
      throw new ConvexError("Report target does not belong to this club");
    }
    if (args.reportedUserId && args.reportedUserId !== announcement.authorId) {
      throw new ConvexError("Reported user does not match the content author");
    }
    return { clubId: announcement.clubId, reportedUserId: announcement.authorId };
  }

  if (args.contentType === "EVENT") {
    const eventId = ctx.db.normalizeId("events", args.contentId);
    if (!eventId) throw new ConvexError("Report target not found");
    const event = await ctx.db.get(eventId);
    if (!event || event.status !== "PUBLISHED") {
      throw new ConvexError("Report target not found");
    }
    if (args.clubId && event.clubId !== args.clubId) {
      throw new ConvexError("Report target does not belong to this club");
    }
    if (event.clubId) {
      const context = await getViewerContext(ctx, event.clubId, user);
      if (!context.canAccessWorkspace) {
        throw new ConvexError("Not authorized to report this content");
      }
    }
    if (args.reportedUserId && args.reportedUserId !== event.authorId) {
      throw new ConvexError("Reported user does not match the content author");
    }
    return { clubId: event.clubId, reportedUserId: event.authorId };
  }

  throw new ConvexError("Unsupported report target");
}

export const list = query({
  args: {
    status: v.optional(moderationReportStatusValidator),
    clubId: v.optional(v.id("clubs")),
    isEscalated: v.optional(v.boolean()),
  },
  returns: v.array(reportValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) {
      return [];
    }

    const canViewAll = requireAnyRoleSafe(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);
    if (!canViewAll) {
      if (!args.clubId) return [];
      const context = await getViewerContext(ctx, args.clubId, user);
      if (!context.canManageMembership) return [];
    }

    let reports = args.clubId
      ? await ctx.db
          .query("moderationReports")
          .withIndex("by_clubId_and_createdAt", (q) => q.eq("clubId", args.clubId))
          .order("desc")
          .take(200)
      : await ctx.db
          .query("moderationReports")
          .withIndex("by_createdAt")
          .order("desc")
          .take(200);

    if (args.status) {
      reports = reports.filter((r) => r.status === args.status);
    }
    if (args.isEscalated !== undefined) {
      reports = reports.filter((r) => r.isEscalated === args.isEscalated);
    }

    return Promise.all(reports.map((r) => serializeReport(ctx, r)));
  },
});

export const submit = mutation({
  args: {
    contentType: v.string(),
    contentId: v.string(),
    reason: v.string(),
    reportedUserId: v.optional(v.id("users")),
    clubId: v.optional(v.id("clubs")),
  },
  returns: v.id("moderationReports"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const reason = args.reason.trim();
    if (!reason) throw new ConvexError("Reason required");
    const target = await validateReportTarget(ctx, user, args);

    const reportId = await ctx.db.insert("moderationReports", {
      submitterId: user._id,
      contentType: args.contentType,
      contentId: args.contentId,
      reason,
      reportedUserId: target.reportedUserId,
      clubId: target.clubId,
      status: "PENDING",
      isEscalated: false,
      createdAt: Date.now(),
    });

    await deliverMany(ctx, (await activeAdmins(ctx)).map((admin) => admin._id), {
      category: "CONTENT_MODERATED",
      title: "Moderation report submitted",
      body: `${user.firstName} ${user.lastName} submitted a moderation report.`,
      href: "/admin?tab=moderation",
      subject: { kind: "moderationReport", reportId },
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "REPORT_SUBMITTED",
      entityType: "Report",
      entityId: reportId,
      meta: { contentType: args.contentType, contentId: args.contentId },
    });

    return reportId;
  },
});

export const update = mutation({
  args: {
    reportId: v.id("moderationReports"),
    status: docs.moderationReports.fields.status,
    reviewNote: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"]);

    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("Report not found");

    await ctx.db.patch(args.reportId, {
      status: args.status,
      reviewNote: args.reviewNote,
      reviewedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "REPORT_UPDATED",
      entityType: "Report",
      entityId: args.reportId,
      meta: { status: args.status },
    });

    return { success: true };
  },
});
