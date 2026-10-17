import { ConvexError, v } from "convex/values";
import { getCurrentAppUser } from "../../lib/currentUser";
import { mutation, query } from "../_generated/server";
import { logAuditEvent } from "../audit/_lib";
import { canReviewFeedback } from "./feedbackAccess";

const bugColorValidator = v.union(
  v.literal("amber"), v.literal("blue"), v.literal("emerald"),
  v.literal("pink"), v.literal("purple"), v.literal("red"),
);

export const myReward = query({
  args: {},
  returns: v.object({ approvedCount: v.number(), color: v.union(bugColorValidator, v.null()) }),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    return {
      approvedCount: user.approvedBugCount ?? 0,
      color: (user.bugTagColor as "amber" | "blue" | "emerald" | "pink" | "purple" | "red" | undefined) ?? null,
    };
  },
});

export const approve = mutation({
  args: { reportId: v.id("moderationReports") },
  returns: v.number(),
  handler: async (ctx, { reportId }) => {
    const reviewer = await getCurrentAppUser(ctx);
    if (!reviewer.isDeveloper || !canReviewFeedback(reviewer)) {
      throw new ConvexError("Only a developer with feedback review access can approve bugs.");
    }
    const report = await ctx.db.get(reportId);
    if (!report || report.contentType !== "GENERAL" || report.feedbackKind !== "BUG") {
      throw new ConvexError("This is not a bug report.");
    }
    if (report.status === "DISMISSED") throw new ConvexError("Dismissed reports cannot earn a bug tag.");
    const submitter = await ctx.db.get(report.submitterId);
    if (!submitter) throw new ConvexError("Submitter not found.");
    if (report.bugApprovedAt) return submitter.approvedBugCount ?? 0;

    const approvedCount = (submitter.approvedBugCount ?? 0) + 1;
    await ctx.db.patch(report._id, { bugApprovedAt: Date.now(), bugApprovedById: reviewer._id });
    await ctx.db.patch(submitter._id, { approvedBugCount: approvedCount, updatedAt: Date.now() });
    await logAuditEvent(ctx, {
      actorId: reviewer._id, action: "BUG_REPORT_APPROVED", entityType: "Report", entityId: report._id,
      meta: { submitterId: submitter._id, approvedCount },
    });
    return approvedCount;
  },
});

export const setColor = mutation({
  args: { color: bugColorValidator },
  returns: v.null(),
  handler: async (ctx, { color }) => {
    const user = await getCurrentAppUser(ctx);
    if ((user.approvedBugCount ?? 0) < 5) throw new ConvexError("Five approved bugs are needed to choose a tag color.");
    await ctx.db.patch(user._id, { bugTagColor: color, updatedAt: Date.now() });
    return null;
  },
});
