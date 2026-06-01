import { ConvexError, v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { mutation, query } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser, requireAnyRole, requireAnyRoleSafe } from "../../lib/currentUser";
import { logAuditEvent } from "../audit/_lib";
import { docs } from "../../lib/docs";

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

export const list = query({
  args: {
    status: v.optional(docs.moderationReports.fields.status),
    clubId: v.optional(v.id("clubs")),
    isEscalated: v.optional(v.boolean()),
  },
  returns: v.array(reportValidator),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !requireAnyRoleSafe(user, ["ADMIN", "SUPER_ADMIN", "SUPPORT_STAFF", "TEACHER"])) {
      return [];
    }

    let reports = await ctx.db.query("moderationReports").order("desc").take(200);

    if (args.status) {
      reports = reports.filter((r) => r.status === args.status);
    }
    if (args.clubId) {
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

    const reportId = await ctx.db.insert("moderationReports", {
      submitterId: user._id,
      contentType: args.contentType,
      contentId: args.contentId,
      reason,
      reportedUserId: args.reportedUserId,
      clubId: args.clubId,
      status: "PENDING",
      isEscalated: false,
      createdAt: Date.now(),
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
