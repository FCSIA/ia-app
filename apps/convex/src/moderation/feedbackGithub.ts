import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { env, httpAction, internalAction, internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { deliverNotification } from "../notifications/delivery";
import { logAuditEvent } from "../audit/_lib";

const GITHUB_REPOSITORY = "FCSIA/ia-app";
const GITHUB_API_VERSION = "2022-11-28";

type FeedbackStatus = "PENDING" | "RESOLVED" | "DISMISSED";

// PATCHes one push run sends before handing over to a fresh run.
const MAX_PUSH_ROUNDS = 3;
// Each PATCH gives up after this, so a round never outlives the lease.
const PUSH_REQUEST_TIMEOUT_MS = 30 * 1000;
// A push renews this lease every round; one that stops renewing has died.
const PUSH_LEASE_MS = 5 * 60 * 1000;
const PUSH_HANDOFF_DELAY_MS = 5 * 1000;

/** Whether a push is mirroring the app's status onto the issue. */
function isPushInFlight(report: Doc<"moderationReports">, now: number) {
  return (
    report.githubIssuePushingSince !== undefined &&
    now - report.githubIssuePushingSince < PUSH_LEASE_MS
  );
}

/**
 * Mirrors the report's status onto its GitHub issue. At most one push runs per
 * report: while one is in flight it picks up any newer status before it
 * finishes, so pushes never overlap or land out of order.
 */
export async function requestGithubIssuePush(
  ctx: MutationCtx,
  report: Doc<"moderationReports">,
) {
  const now = Date.now();
  if (isPushInFlight(report, now)) return;
  await ctx.db.patch(report._id, { githubIssuePushingSince: now });
  await ctx.scheduler.runAfter(0, internal.moderation.feedbackGithub.pushGithubIssueState, {
    reportId: report._id,
  });
}

const feedbackStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("RESOLVED"),
  v.literal("DISMISSED"),
);

/** The GitHub issue state that matches a feedback status set in the app. */
export function githubIssueStateFor(status: FeedbackStatus) {
  if (status === "PENDING") return { state: "open" as const };
  return {
    state: "closed" as const,
    state_reason: status === "DISMISSED" ? ("not_planned" as const) : ("completed" as const),
  };
}

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
    // Staff may have decided before the issue existed; new issues open as
    // PENDING, so carry any other decision over.
    if (report.status !== "PENDING") {
      await requestGithubIssuePush(ctx, report);
    }
    await logAuditEvent(ctx, { actorId: "system",
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
    await logAuditEvent(ctx, { actorId: "system",
      action: "FEEDBACK_GITHUB_ISSUE_FAILED",
      entityType: "Report",
      entityId: args.reportId,
    });
    return null;
  },
});

export const loadGithubIssueState = internalQuery({
  args: { reportId: v.id("moderationReports") },
  returns: v.union(
    v.null(),
    v.object({
      issueNumber: v.number(),
      status: feedbackStatusValidator,
      stateUpdatedAt: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL" || report.githubIssueNumber === undefined) {
      return null;
    }
    return {
      issueNumber: report.githubIssueNumber,
      status: report.status,
      ...(report.githubIssueStateUpdatedAt !== undefined
        ? { stateUpdatedAt: report.githubIssueStateUpdatedAt }
        : {}),
    };
  },
});

/**
 * Records a push round. `githubUpdatedAt` is the issue's `updated_at` after
 * our PATCH, so later-arriving echoes of it count as older events. The push is
 * finished only if the report still has the status that was sent and no newer
 * GitHub change arrived during the round (it was ignored, so it must be
 * overwritten). `seenStateUpdatedAt` is the stored timestamp when the round
 * read the report: only a change to it during the round counts, because the
 * stored value may be a staff decision time from Convex's millisecond clock
 * that is later than GitHub's whole-second `updated_at` for the same moment.
 * The check runs in the same transaction that clears the in-flight marker;
 * otherwise the lease is renewed and the push keeps going. `status: null`
 * ends the push without a match (it failed).
 */
export const finishGithubIssuePushRound = internalMutation({
  args: {
    reportId: v.id("moderationReports"),
    status: v.union(feedbackStatusValidator, v.null()),
    githubUpdatedAt: v.optional(v.number()),
    seenStateUpdatedAt: v.optional(v.number()),
  },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report) return true;
    const stored = report.githubIssueStateUpdatedAt;
    const newerGithubChange =
      args.githubUpdatedAt !== undefined &&
      stored !== args.seenStateUpdatedAt &&
      (stored ?? 0) > args.githubUpdatedAt;
    const done =
      args.status === null || (report.status === args.status && !newerGithubChange);
    await ctx.db.patch(report._id, {
      ...(args.githubUpdatedAt !== undefined &&
      (report.githubIssueStateUpdatedAt ?? 0) < args.githubUpdatedAt
        ? { githubIssueStateUpdatedAt: args.githubUpdatedAt }
        : {}),
      githubIssuePushingSince: done ? undefined : Date.now(),
    });
    return done;
  },
});

function issueUpdatedAt(body: unknown) {
  if (!body || typeof body !== "object") return undefined;
  const value = (body as Record<string, unknown>).updated_at;
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** The single push run for a report; see `requestGithubIssuePush`. */
export const pushGithubIssueState = internalAction({
  args: { reportId: v.id("moderationReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const finish = (
      status: FeedbackStatus | null,
      githubUpdatedAt?: number,
      seenStateUpdatedAt?: number,
    ) =>
      ctx.runMutation(internal.moderation.feedbackGithub.finishGithubIssuePushRound, {
        reportId: args.reportId,
        status,
        ...(githubUpdatedAt !== undefined ? { githubUpdatedAt } : {}),
        ...(seenStateUpdatedAt !== undefined ? { seenStateUpdatedAt } : {}),
      });
    const token = env.GITHUB_FEEDBACK_TOKEN;
    try {
      for (let round = 0; round < MAX_PUSH_ROUNDS; round += 1) {
        const current = await ctx.runQuery(internal.moderation.feedbackGithub.loadGithubIssueState, args);
        if (!current || !token) {
          await finish(null);
          return null;
        }
        const sentAt = Date.now();
        const response = await fetch(
          `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${current.issueNumber}`,
          {
            method: "PATCH",
            headers: { ...githubHeaders(token), "Content-Type": "application/json" },
            body: JSON.stringify(githubIssueStateFor(current.status)),
            signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS),
          },
        );
        if (!response.ok) {
          // The app status stays authoritative; the issue is only a mirror.
          console.warn(`GitHub issue #${current.issueNumber} state update failed (${response.status})`);
          await finish(null);
          return null;
        }
        const body: unknown = await response.json().catch(() => null);
        if (await finish(current.status, issueUpdatedAt(body) ?? sentAt, current.stateUpdatedAt)) {
          return null;
        }
      }
    } catch (error) {
      // Release the lease so the next staff decision can push again.
      console.warn(`GitHub issue state push failed: ${error instanceof Error ? error.message : String(error)}`);
      await finish(null).catch(() => {});
      return null;
    }
    // Staff kept changing the status; continue in a fresh run so the issue
    // still ends on the latest decision. The pause caps the PATCH rate if the
    // run ever fails to settle.
    await ctx.scheduler.runAfter(PUSH_HANDOFF_DELAY_MS, internal.moderation.feedbackGithub.pushGithubIssueState, args);
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
    status: feedbackStatusValidator,
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
    // GitHub agreeing with the current status (including the echo of a staff
    // change pushed to the issue) must not replace the staff review note.
    if (report.status === args.status) {
      await ctx.db.patch(report._id, { githubIssueStateUpdatedAt: args.githubUpdatedAt });
      return null;
    }
    // While a push is mirroring the app's status onto the issue, a disagreeing
    // event is either the echo of an earlier push or a change that push is
    // about to overwrite, so the app's status stands.
    if (isPushInFlight(report, Date.now())) {
      await ctx.db.patch(report._id, { githubIssueStateUpdatedAt: args.githubUpdatedAt });
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
    await logAuditEvent(ctx, { actorId: "system",
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
