import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole, requireAnyRoleSafe } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { docs } from "../../lib/docs";
import { activeAdmins, deliverMany } from "../notifications/delivery";
import { canReadChannel, getViewerContext } from "../clubs/access";
import { normalizeModerationReportReason } from "./reportValidation";
import { contentRateLimiter } from "../rateLimits";

const genericReportContentTypeValidator = v.union(v.literal("GENERAL"), v.literal("ANNOUNCEMENT"), v.literal("EVENT"));

const userRefValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
  uniqueId: v.string(),
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
          uniqueId: submitter.uniqueId,
        }
      : null,
    reportedUser: reportedUser
      ? {
          _id: reportedUser._id,
          firstName: reportedUser.firstName,
          lastName: reportedUser.lastName,
          uniqueId: reportedUser.uniqueId,
        }
      : null,
    club: club ? { _id: club._id, name: club.name } : null,
  };
}

async function createReport(
  ctx: MutationCtx,
  user: Doc<"users">,
  input: {
    contentType: "GENERAL" | "ANNOUNCEMENT" | "EVENT" | "CLUB_CHANNEL_MESSAGE";
    contentId: string;
    reason: string;
    reportedUserId?: Id<"users">;
    clubId?: Id<"clubs">;
  },
) {
  const rate = await contentRateLimiter.limit(ctx, "reportsByUser", { key: user._id });
  if (!rate.ok) throw new ConvexError("Too many reports. Try again later.");
  const reportId = await ctx.db.insert("moderationReports", {
    submitterId: user._id,
    contentType: input.contentType,
    contentId: input.contentId,
    reason: input.reason,
    reportedUserId: input.reportedUserId,
    clubId: input.clubId,
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
    meta: { contentType: input.contentType, contentId: input.contentId },
  });

  return reportId;
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
    if (!user || !requireAnyRoleSafe(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "TEACHER"])) {
      return [];
    }

    let reports: Doc<"moderationReports">[];
    if (args.status) {
      const status: Doc<"moderationReports">["status"] = args.status;
      reports = await ctx.db
        .query("moderationReports")
        .withIndex("by_status_and_createdAt", (q) => q.eq("status", status))
        .order("desc")
        .take(200);
    } else if (args.clubId) {
      const clubId = args.clubId;
      reports = await ctx.db
        .query("moderationReports")
        .withIndex("by_clubId_and_createdAt", (q) => q.eq("clubId", clubId))
        .order("desc")
        .take(200);
    } else {
      reports = await ctx.db
        .query("moderationReports")
        .withIndex("by_createdAt")
        .order("desc")
        .take(200);
    }

    if (args.clubId && args.status) {
      reports = reports.filter((r) => r.clubId === args.clubId);
    }
    if (args.isEscalated !== undefined) {
      reports = reports.filter((r) => r.isEscalated === args.isEscalated);
    }

    return Promise.all(reports.map((r) => serializeReport(ctx, r)));
  },
});

export const submit = mutation({
  args: {
    contentType: genericReportContentTypeValidator,
    contentId: v.string(),
    reason: v.string(),
    reportedUserId: v.optional(v.id("users")),
    clubId: v.optional(v.id("clubs")),
  },
  returns: v.id("moderationReports"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (Array.from(args.contentId).length < 1 || Array.from(args.contentId).length > 128) throw new ConvexError("Invalid report reference");
    if (args.contentType === "EVENT") {
      const id = ctx.db.normalizeId("events", args.contentId);
      if (!id || !(await ctx.db.get(id))) throw new ConvexError("Event not found");
    }
    if (args.contentType === "ANNOUNCEMENT") {
      const id = ctx.db.normalizeId("announcements", args.contentId);
      if (!id || !(await ctx.db.get(id))) throw new ConvexError("Announcement not found");
    }
    return await createReport(ctx, user, {
      ...args,
      reason: normalizeModerationReportReason(args.reason),
    });
  },
});

export const submitClubChannelMessage = mutation({
  args: {
    messageId: v.id("clubChannelMessages"),
    reason: v.string(),
  },
  returns: v.id("moderationReports"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const message = await ctx.db.get(args.messageId);
    if (!message) throw new ConvexError("Message not found");
    if (message.deletedAt) throw new ConvexError("Message has been deleted");
    const channel = await ctx.db.get(message.channelId);
    if (!channel) throw new ConvexError("Message not found");
    const context = await getViewerContext(ctx, channel.clubId, user);
    const membership = await ctx.db
      .query("clubChannelMemberships")
      .withIndex("by_channelId_and_userId", (q) =>
        q.eq("channelId", channel._id).eq("userId", user._id),
      )
      .first();
    if (
      !canReadChannel(
        { ...channel, memberships: membership ? [membership] : [] },
        context,
        user._id,
      )
    ) {
      throw new ConvexError("Not authorized");
    }

    return await createReport(ctx, user, {
      contentType: "CLUB_CHANNEL_MESSAGE",
      contentId: message._id,
      clubId: channel.clubId,
      reportedUserId: message.authorId,
      reason: normalizeModerationReportReason(args.reason),
    });
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
