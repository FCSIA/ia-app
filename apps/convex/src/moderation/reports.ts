import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import {
  getCurrentAppUser,
  getMaybeCurrentAppUser,
  requireAnyRole,
  requireAnyRoleSafe,
} from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { schema } from "../schema";
import {
  activeAdmins,
  deliverMany,
  deliverNotification,
} from "../notifications/delivery";
import { getViewerContext } from "../clubs/access";
import { getChannelAccess } from "../clubs/channelAccess";
import {
  normalizeFeedbackResponse,
  normalizeModerationReportReason,
} from "./reportValidation";
import { contentRateLimiter } from "../rateLimits";
import { consumeStagedFeedbackImages } from "../uploads/feedbackImages";
import { canReviewFeedback } from "./feedbackAccess";

const genericReportContentTypeValidator = v.union(
  v.literal("GENERAL"),
  v.literal("ANNOUNCEMENT"),
  v.literal("EVENT"),
);
const MAX_FEEDBACK_RESPONSES_PER_REPORT = 25;
const moderationReportStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("RESOLVED"),
  v.literal("DISMISSED"),
);

const userRefValidator = v.object({
  _id: v.id("users"),
  firstName: v.string(),
  lastName: v.string(),
  uniqueId: v.string(),
});

const reportValidator = schema.doc("moderationReports").extend({
  submitter: v.union(userRefValidator, v.null()),
  reportedUser: v.union(userRefValidator, v.null()),
  club: v.union(
    v.object({
      _id: v.id("clubs"),
      name: v.string(),
    }),
    v.null(),
  ),
  images: v.array(
    v.object({
      _id: v.id("feedbackReportImages"),
      storageId: v.id("_storage"),
      mimeType: v.string(),
      size: v.number(),
      url: v.string(),
    }),
  ),
  responses: v.array(
    schema.doc("feedbackReportResponses").extend({
      author: v.object({
        firstName: v.string(),
        lastName: v.string(),
      }),
    }),
  ),
});

const myFeedbackValidator = v.object({
  _id: v.id("moderationReports"),
  reason: v.string(),
  feedbackKind: v.optional(v.union(v.literal("BUG"), v.literal("OTHER"))),
  bugApprovedAt: v.optional(v.number()),
  status: moderationReportStatusValidator,
  reviewNote: v.optional(v.string()),
  createdAt: v.number(),
  responses: v.array(
    v.object({
      _id: v.id("feedbackReportResponses"),
      body: v.string(),
      createdAt: v.number(),
    }),
  ),
});

const reportListArgs = {
  status: v.optional(moderationReportStatusValidator),
  clubId: v.optional(v.id("clubs")),
  isEscalated: v.optional(v.boolean()),
};

async function serializeReport(
  ctx: QueryCtx,
  report: Doc<"moderationReports">,
) {
  const submitter = await ctx.db.get(report.submitterId);
  const reportedUser = report.reportedUserId
    ? await ctx.db.get(report.reportedUserId)
    : null;
  const club = report.clubId ? await ctx.db.get(report.clubId) : null;
  const images = await ctx.db
    .query("feedbackReportImages")
    .withIndex("by_reportId_and_createdAt", (q) => q.eq("reportId", report._id))
    .take(3);
  const responses = await ctx.db
    .query("feedbackReportResponses")
    .withIndex("by_reportId_and_createdAt", (q) => q.eq("reportId", report._id))
    .take(MAX_FEEDBACK_RESPONSES_PER_REPORT);

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
    images: await Promise.all(
      images.map(async (image) => ({
        _id: image._id,
        storageId: image.storageId,
        mimeType: image.mimeType,
        size: image.size,
        url: (await ctx.storage.getUrl(image.storageId)) ?? "",
      })),
    ),
    responses: await Promise.all(
      responses.map(async (response) => {
        const author = await ctx.db.get(response.authorId);
        return {
          ...response,
          author: {
            firstName: author?.firstName ?? "School",
            lastName: author?.lastName ?? "staff",
          },
        };
      }),
    ),
  };
}

async function listFeedbackResponsesForSubmitter(
  ctx: QueryCtx,
  reportId: Id<"moderationReports">,
) {
  return await ctx.db
    .query("feedbackReportResponses")
    .withIndex("by_reportId_and_createdAt", (q) => q.eq("reportId", reportId))
    .take(MAX_FEEDBACK_RESPONSES_PER_REPORT);
}

async function createReport(
  ctx: MutationCtx,
  user: Doc<"users">,
  input: {
    contentType: "GENERAL" | "ANNOUNCEMENT" | "EVENT" | "CLUB_CHANNEL_MESSAGE";
    contentId: string;
    reason: string;
    appVersion?: string;
    feedbackKind?: "BUG" | "OTHER";
    reportedUserId?: Id<"users">;
    clubId?: Id<"clubs">;
    imageUploadIds?: Id<"feedbackImageUploads">[];
  },
) {
  const rate = await contentRateLimiter.limit(ctx, "reportsByUser", {
    key: user._id,
  });
  if (!rate.ok) throw new ConvexError("Too many reports. Try again later.");
  const reportId = await ctx.db.insert("moderationReports", {
    submitterId: user._id,
    contentType: input.contentType,
    contentId: input.contentId,
    reason: input.reason,
    ...(input.feedbackKind ? { feedbackKind: input.feedbackKind } : {}),
    ...(input.appVersion ? { appVersion: input.appVersion } : {}),
    reportedUserId: input.reportedUserId,
    clubId: input.clubId,
    status: "PENDING",
    isEscalated: false,
    ...(input.contentType === "GENERAL" ? { githubIssueSyncState: "PENDING" as const } : {}),
    createdAt: Date.now(),
  });
  if (input.imageUploadIds) {
    await consumeStagedFeedbackImages(ctx, {
      imageUploadIds: input.imageUploadIds,
      uploaderId: user._id,
      reportId,
    });
  }

  const isFeedback = input.contentType === "GENERAL";
  const recipients = (await activeAdmins(ctx)).filter((admin) =>
    isFeedback ? admin.roles.includes("SUPER_ADMIN") : true,
  );

  await deliverMany(
    ctx,
    recipients.map((admin) => admin._id),
    {
      category: isFeedback ? "FEEDBACK" : "CONTENT_MODERATED",
      title: isFeedback ? "Feedback submitted" : "Moderation report submitted",
      body: `${user.firstName} ${user.lastName} submitted ${isFeedback ? "feedback" : "a moderation report"}.`,
      href: isFeedback ? "/admin?tab=feedback" : "/admin?tab=moderation",
      subject: { kind: "moderationReport", reportId },
    },
  );

  await logAuditEvent(ctx, {
    actorId: user._id,
    action: "REPORT_SUBMITTED",
    entityType: "Report",
    entityId: reportId,
    meta: { contentType: input.contentType, contentId: input.contentId },
  });

  if (isFeedback) {
    await ctx.scheduler.runAfter(0, internal.moderation.feedbackGithub.syncFeedbackIssue, {
      reportId,
    });
  }

  return reportId;
}

async function loadReports(
  ctx: QueryCtx,
  args: {
    status?: Doc<"moderationReports">["status"];
    clubId?: Id<"clubs">;
    isEscalated?: boolean;
  },
) {
  let reports: Doc<"moderationReports">[];
  if (args.status) {
    reports = await ctx.db
      .query("moderationReports")
      .withIndex("by_status_and_createdAt", (q) => q.eq("status", args.status!))
      .order("desc")
      .take(200);
  } else if (args.clubId) {
    reports = await ctx.db
      .query("moderationReports")
      .withIndex("by_clubId_and_createdAt", (q) => q.eq("clubId", args.clubId!))
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
    reports = reports.filter((report) => report.clubId === args.clubId);
  }
  if (args.isEscalated !== undefined) {
    reports = reports.filter(
      (report) => report.isEscalated === args.isEscalated,
    );
  }

  return reports;
}

export const list = query({
  args: reportListArgs,
  returns: v.array(reportValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (
      !user ||
      !requireAnyRoleSafe(user, [
        "ADMIN",
        "SUPER_ADMIN",
        "SUPPORT_STAFF",
        "TEACHER",
      ])
    ) {
      return [];
    }

    const reports = await loadReports(ctx, args);
    return Promise.all(
      reports
        .filter((report) => report.contentType !== "GENERAL")
        .map((report) => serializeReport(ctx, report)),
    );
  },
});

export const listFeedback = query({
  args: {},
  returns: v.array(reportValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !canReviewFeedback(user)) {
      return [];
    }

    const reports = await loadReports(ctx, {});
    return Promise.all(
      reports
        .filter((report) => report.contentType === "GENERAL")
        .map((report) => serializeReport(ctx, report)),
    );
  },
});

export const listMyFeedback = query({
  args: {},
  returns: v.array(myFeedbackValidator),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return [];

    const reports = await ctx.db
      .query("moderationReports")
      .withIndex("by_submitterId_and_contentType_and_createdAt", (q) =>
        q.eq("submitterId", user._id).eq("contentType", "GENERAL"),
      )
      .order("desc")
      .take(100);

    return await Promise.all(
      reports.map(async (report) => ({
        _id: report._id,
        reason: report.reason,
        feedbackKind: report.feedbackKind,
        bugApprovedAt: report.bugApprovedAt,
        status: report.status,
        reviewNote: report.reviewNote,
        createdAt: report.createdAt,
        responses: (
          await listFeedbackResponsesForSubmitter(ctx, report._id)
        ).map((response) => ({
          _id: response._id,
          body: response.body,
          createdAt: response.createdAt,
        })),
      })),
    );
  },
});

export const submit = mutation({
  args: {
    contentType: genericReportContentTypeValidator,
    contentId: v.string(),
    reason: v.string(),
    reportedUserId: v.optional(v.id("users")),
    clubId: v.optional(v.id("clubs")),
    imageUploadIds: v.optional(v.array(v.id("feedbackImageUploads"))),
    appVersion: v.optional(v.string()),
    feedbackKind: v.optional(v.union(v.literal("BUG"), v.literal("OTHER"))),
  },
  returns: v.id("moderationReports"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (
      Array.from(args.contentId).length < 1 ||
      Array.from(args.contentId).length > 128
    )
      throw new ConvexError("Invalid report reference");
    if (args.imageUploadIds && args.contentType !== "GENERAL") {
      throw new ConvexError("Images can only be attached to feedback");
    }
    if (args.appVersion && args.contentType !== "GENERAL") {
      throw new ConvexError("App versions can only be attached to feedback");
    }
    if (args.feedbackKind && args.contentType !== "GENERAL") {
      throw new ConvexError("Feedback type can only be set for general feedback");
    }
    const appVersion = args.appVersion?.trim();
    if (appVersion && Array.from(appVersion).length > 64) {
      throw new ConvexError("Invalid app version");
    }
    if (args.contentType === "EVENT") {
      const id = ctx.db.normalizeId("events", args.contentId);
      if (!id || !(await ctx.db.get(id)))
        throw new ConvexError("Event not found");
    }
    if (args.contentType === "ANNOUNCEMENT") {
      const id = ctx.db.normalizeId("announcements", args.contentId);
      if (!id || !(await ctx.db.get(id)))
        throw new ConvexError("Announcement not found");
    }
    return await createReport(ctx, user, {
      ...args,
      ...(appVersion ? { appVersion } : {}),
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
    if (!(await getChannelAccess(ctx, channel, context, user._id)).canView) {
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
    status: schema.doc("moderationReports").fields.status,
    reviewNote: v.string(),
  },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);

    const report = await ctx.db.get(args.reportId);
    if (!report) throw new ConvexError("Report not found");

    requireAnyRole(
      user,
      report.contentType === "GENERAL"
        ? ["SUPER_ADMIN"]
        : ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF"],
    );

    await ctx.db.patch(args.reportId, {
      status: args.status,
      reviewNote: args.reviewNote,
      reviewedAt: Date.now(),
    });

    if (
      report.contentType === "GENERAL" &&
      report.status !== "RESOLVED" &&
      args.status === "RESOLVED"
    ) {
      await deliverNotification(ctx, {
        userId: report.submitterId,
        category: "FEEDBACK",
        title: "Your feedback was resolved",
        body: args.reviewNote || "School staff reviewed your feedback.",
        href: "/report",
        subject: { kind: "moderationReport", reportId: report._id },
      });
    }

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

export const retryGithubIssueSync = mutation({
  args: { reportId: v.id("moderationReports") },
  returns: v.object({ success: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["SUPER_ADMIN"]);
    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL") {
      throw new ConvexError("Feedback not found");
    }
    if (report.githubIssueNumber) {
      throw new ConvexError("This feedback already has a GitHub issue");
    }
    if (report.githubIssueSyncState === "PENDING") {
      throw new ConvexError("GitHub issue sync is already queued");
    }

    await ctx.db.patch(report._id, {
      githubIssueSyncState: "PENDING",
      githubIssueSyncError: null,
    });
    await ctx.scheduler.runAfter(0, internal.moderation.feedbackGithub.syncFeedbackIssue, {
      reportId: report._id,
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "FEEDBACK_GITHUB_ISSUE_RETRY_QUEUED",
      entityType: "Report",
      entityId: report._id,
    });
    return { success: true };
  },
});

export const addFeedbackResponse = mutation({
  args: {
    reportId: v.id("moderationReports"),
    body: v.string(),
  },
  returns: v.id("feedbackReportResponses"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    requireAnyRole(user, ["SUPER_ADMIN"]);

    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL") {
      throw new ConvexError("Feedback not found");
    }

    const body = normalizeFeedbackResponse(args.body);
    const existingResponses = await ctx.db
      .query("feedbackReportResponses")
      .withIndex("by_reportId_and_createdAt", (q) =>
        q.eq("reportId", report._id),
      )
      .take(MAX_FEEDBACK_RESPONSES_PER_REPORT);
    if (existingResponses.length >= MAX_FEEDBACK_RESPONSES_PER_REPORT) {
      throw new ConvexError(
        "This feedback already has the maximum number of staff responses",
      );
    }
    const responseId = await ctx.db.insert("feedbackReportResponses", {
      reportId: report._id,
      authorId: user._id,
      body,
      createdAt: Date.now(),
    });

    await deliverNotification(ctx, {
      userId: report.submitterId,
      category: "FEEDBACK",
      title: "School staff replied to your feedback",
      body,
      href: "/report",
      subject: { kind: "moderationReport", reportId: report._id },
    });

    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "FEEDBACK_RESPONSE_ADDED",
      entityType: "Report",
      entityId: report._id,
      meta: { responseId },
    });

    return responseId;
  },
});
