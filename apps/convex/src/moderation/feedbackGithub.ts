import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { env, httpAction, internalAction, internalMutation, internalQuery } from "../_generated/server";
import { deliverNotification } from "../notifications/delivery";
import { logAuditEvent } from "../audit/_lib";

const GITHUB_REPOSITORY = "virajdas/ia-app";
const GITHUB_API_VERSION = "2022-11-28";

type FeedbackStatus = "PENDING" | "RESOLVED" | "DISMISSED";

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

function issueTitle(reportId: Id<"moderationReports">) {
  return `IA app feedback (${reportId.slice(-8)})`;
}

function issueBody(report: Pick<Doc<"moderationReports">, "_id" | "reason">) {
  return [
    "Submitted through the IA app feedback form.",
    "",
    "Do not add student-identifying information or attachments to this issue.",
    "",
    "---",
    "",
    report.reason,
    "",
    "---",
    "",
    `Convex feedback record: \`${report._id}\``,
  ].join("\n");
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message.slice(0, 500) : "Unable to create GitHub issue";
}

async function hmacSha256Hex(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hasValidSignature(body: string, signature: string | null, secret: string) {
  if (!signature) return false;
  const expected = `sha256=${await hmacSha256Hex(body, secret)}`;
  if (signature.length !== expected.length) return false;

  let difference = 0;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ signature.charCodeAt(index);
  }
  return difference === 0;
}

function isIssueWebhook(payload: unknown): payload is {
  action: string;
  repository: { full_name: string };
  issue: { number: number; state_reason?: string | null; updated_at: string };
} {
  if (!payload || typeof payload !== "object") return false;
  const value = payload as Record<string, unknown>;
  const repository = value.repository;
  const issue = value.issue;
  return (
    typeof value.action === "string" &&
    !!repository &&
    typeof repository === "object" &&
    typeof (repository as Record<string, unknown>).full_name === "string" &&
    !!issue &&
    typeof issue === "object" &&
    typeof (issue as Record<string, unknown>).number === "number" &&
    typeof (issue as Record<string, unknown>).updated_at === "string"
  );
}

export function statusForGithubIssue(action: string, stateReason: string | null | undefined): FeedbackStatus | null {
  if (action === "reopened") return "PENDING";
  if (action !== "closed") return null;
  return stateReason === "not_planned" ? "DISMISSED" : "RESOLVED";
}

export const loadPendingFeedback = internalQuery({
  args: { reportId: v.id("moderationReports") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("moderationReports"),
      reason: v.string(),
      githubIssueNumber: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL" || report.githubIssueNumber) return null;
    return {
      _id: report._id,
      reason: report.reason,
      githubIssueNumber: report.githubIssueNumber,
    };
  },
});

export const saveGithubIssue = internalMutation({
  args: {
    reportId: v.id("moderationReports"),
    issueNumber: v.number(),
    issueUrl: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL" || report.githubIssueNumber) return null;
    await ctx.db.patch(args.reportId, {
      githubIssueNumber: args.issueNumber,
      githubIssueUrl: args.issueUrl,
      githubIssueSyncState: "SYNCED",
      githubIssueCreatedAt: Date.now(),
      githubIssueSyncError: null,
    });
    await logAuditEvent(ctx, {
      action: "FEEDBACK_GITHUB_ISSUE_CREATED",
      entityType: "Report",
      entityId: args.reportId,
      meta: { issueNumber: args.issueNumber },
    });
    return null;
  },
});

export const saveGithubIssueFailure = internalMutation({
  args: { reportId: v.id("moderationReports"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL" || report.githubIssueNumber) return null;
    await ctx.db.patch(args.reportId, {
      githubIssueSyncState: "FAILED",
      githubIssueSyncError: args.error,
    });
    await logAuditEvent(ctx, {
      action: "FEEDBACK_GITHUB_ISSUE_FAILED",
      entityType: "Report",
      entityId: args.reportId,
    });
    return null;
  },
});

export const syncFeedbackIssue = internalAction({
  args: { reportId: v.id("moderationReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.runQuery(internal.moderation.feedbackGithub.loadPendingFeedback, args);
    if (!report) return null;

    const token = env.GITHUB_FEEDBACK_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.moderation.feedbackGithub.saveGithubIssueFailure, {
        reportId: args.reportId,
        error: "GITHUB_FEEDBACK_TOKEN is not configured",
      });
      return null;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues`, {
        method: "POST",
        headers: { ...githubHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ title: issueTitle(report._id), body: issueBody(report) }),
      });
      if (!response.ok) throw new Error(`GitHub issue creation failed (${response.status})`);
      const body: unknown = await response.json();
      if (
        !body ||
        typeof body !== "object" ||
        typeof (body as Record<string, unknown>).number !== "number" ||
        typeof (body as Record<string, unknown>).html_url !== "string"
      ) {
        throw new Error("GitHub returned an invalid issue response");
      }
      await ctx.runMutation(internal.moderation.feedbackGithub.saveGithubIssue, {
        reportId: args.reportId,
        issueNumber: (body as { number: number }).number,
        issueUrl: (body as { html_url: string }).html_url,
      });
    } catch (error) {
      await ctx.runMutation(internal.moderation.feedbackGithub.saveGithubIssueFailure, {
        reportId: args.reportId,
        error: errorMessage(error),
      });
    }
    return null;
  },
});

export const applyGithubIssueState = internalMutation({
  args: {
    issueNumber: v.number(),
    status: v.union(v.literal("PENDING"), v.literal("RESOLVED"), v.literal("DISMISSED")),
    githubUpdatedAt: v.number(),
    stateReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("moderationReports")
      .withIndex("by_githubIssueNumber", (q) => q.eq("githubIssueNumber", args.issueNumber))
      .unique();
    if (
      !report ||
      report.contentType !== "GENERAL" ||
      (report.githubIssueStateUpdatedAt !== undefined && report.githubIssueStateUpdatedAt >= args.githubUpdatedAt)
    ) {
      return null;
    }

    const reviewNote =
      args.status === "PENDING"
        ? `GitHub issue #${args.issueNumber} was reopened.`
        : args.status === "DISMISSED"
          ? `GitHub issue #${args.issueNumber} was closed as not planned.`
          : `GitHub issue #${args.issueNumber} was closed as completed.`;
    await ctx.db.patch(report._id, {
      status: args.status,
      reviewNote,
      reviewedAt: Date.now(),
      githubIssueStateUpdatedAt: args.githubUpdatedAt,
    });

    if (report.status !== "RESOLVED" && args.status === "RESOLVED") {
      await deliverNotification(ctx, {
        userId: report.submitterId,
        category: "FEEDBACK",
        title: "Your feedback was resolved",
        body: reviewNote,
        href: "/report",
        subject: { kind: "moderationReport", reportId: report._id },
      });
    }
    await logAuditEvent(ctx, {
      action: "FEEDBACK_GITHUB_ISSUE_STATE_SYNCED",
      entityType: "Report",
      entityId: report._id,
      meta: { issueNumber: args.issueNumber, status: args.status, stateReason: args.stateReason },
    });
    return null;
  },
});

function jsonResponse(status: number) {
  return new Response(null, { status });
}

export const httpGithubFeedbackWebhook = httpAction(async (ctx, request) => {
  const secret = env.GITHUB_FEEDBACK_WEBHOOK_SECRET;
  if (!secret) return jsonResponse(503);

  const rawBody = await request.text();
  if (!(await hasValidSignature(rawBody, request.headers.get("x-hub-signature-256"), secret))) {
    return jsonResponse(401);
  }
  if (request.headers.get("x-github-event") === "ping") return jsonResponse(204);
  if (request.headers.get("x-github-event") !== "issues") return jsonResponse(204);

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse(400);
  }
  if (!isIssueWebhook(payload) || payload.repository.full_name !== GITHUB_REPOSITORY) {
    return jsonResponse(204);
  }
  const status = statusForGithubIssue(payload.action, payload.issue.state_reason);
  if (!status) return jsonResponse(204);
  const githubUpdatedAt = Date.parse(payload.issue.updated_at);
  if (Number.isNaN(githubUpdatedAt)) return jsonResponse(204);

  await ctx.runMutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
    issueNumber: payload.issue.number,
    status,
    githubUpdatedAt,
    ...(payload.issue.state_reason ? { stateReason: payload.issue.state_reason } : {}),
  });
  return jsonResponse(204);
});
