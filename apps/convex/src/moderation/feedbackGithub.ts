import { v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import { env, httpAction, internalAction, internalMutation, internalQuery, type MutationCtx } from "../_generated/server";
import { deliverNotification } from "../notifications/delivery";
import { feedbackMetadataValidator } from "./feedbackMetadata";
import { feedbackGithubToken } from "./feedbackGithubToken";
import { logAuditEvent } from "../audit/_lib";
import { isOpenFeedbackStatus, type FeedbackStatus } from "../../../shared/feedback-status";

const GITHUB_REPOSITORY = "FCSIA/ia-app";
const GITHUB_API_VERSION = "2022-11-28";

/** Statuses a GitHub issue event can express; IN_REVIEW is app-only. */
type GithubFeedbackStatus = Exclude<FeedbackStatus, "IN_REVIEW">;

// PATCHes one push run sends before handing over to a fresh run.
const MAX_PUSH_ROUNDS = 3;
// Each GitHub request gives up after this, so a round never outlives the lease.
const PUSH_REQUEST_TIMEOUT_MS = 30 * 1000;
// A push renews this lease every round; one that stops renewing has died.
export const PUSH_LEASE_MS = 5 * 60 * 1000;
const PUSH_HANDOFF_DELAY_MS = 5 * 1000;
// GitHub's API reads can briefly trail the webhook for the same change.
const ISSUE_RECONCILE_DELAY_MS = 5 * 1000;

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
 * finishes, so pushes never overlap or land out of order. A push that dies
 * first is restarted by `restartStalledGithubIssuePushes`.
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

const STALLED_PUSH_BATCH = 50;

/**
 * Restarts pushes whose run was killed (by a crash or deploy) before it
 * released its lease. Decisions made meanwhile were left to that run, so the
 * new push sends the latest status. Runs on a cron.
 */
export const restartStalledGithubIssuePushes = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const stalled = await ctx.db
      .query("moderationReports")
      .withIndex("by_githubIssuePushingSince", (q) =>
        q.gte("githubIssuePushingSince", 0).lte("githubIssuePushingSince", now - PUSH_LEASE_MS),
      )
      .take(STALLED_PUSH_BATCH);
    for (const report of stalled) {
      await requestGithubIssuePush(ctx, report);
    }
    return null;
  },
});

const githubFeedbackStatusValidator = v.union(
  v.literal("PENDING"),
  v.literal("RESOLVED"),
  v.literal("DISMISSED"),
);
const feedbackStatusValidator = v.union(
  githubFeedbackStatusValidator,
  v.literal("IN_REVIEW"),
);

/** The GitHub issue state that matches a feedback status set in the app. */
export function githubIssueStateFor(status: FeedbackStatus) {
  if (isOpenFeedbackStatus(status)) return { state: "open" as const };
  return {
    state: "closed" as const,
    state_reason: status === "DISMISSED" ? ("not_planned" as const) : ("completed" as const),
  };
}

/** Whether two statuses leave the GitHub issue in the same state. */
export function sameGithubIssueState(a: FeedbackStatus, b: FeedbackStatus) {
  const left = githubIssueStateFor(a);
  const right = githubIssueStateFor(b);
  return (
    left.state === right.state &&
    ("state_reason" in left ? left.state_reason : null) ===
      ("state_reason" in right ? right.state_reason : null)
  );
}

function githubHeaders(token: string) {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
}

export function issueTitle(reason: string) {
  const firstLine = reason.split(/\r?\n/).find((line) => line.trim())?.trim() ?? "Feedback";
  return firstLine.length > 100 ? `${firstLine.slice(0, 99)}…` : firstLine;
}

export function issueBody(report: Pick<Doc<"moderationReports">, "_id" | "reason" | "appVersion" | "clientMetadata">, images: string[] = []) {
  const details = [];
  if (report.appVersion) details.push(`App: ${report.appVersion}`);
  const metadata = report.clientMetadata;
  if (metadata) {
    details.push(
      `Browser / device: ${metadata.userAgent}`,
      `Platform: ${metadata.platform}`,
      `Viewport: ${metadata.viewportWidth} × ${metadata.viewportHeight}`,
      `Screen: ${metadata.screenWidth} × ${metadata.screenHeight} (${metadata.pixelRatio}×)`,
      `Touch points: ${metadata.touchPoints}`,
      `Language: ${metadata.language}`,
      `Timezone: ${metadata.timezone}`,
      `Display mode: ${metadata.displayMode}`,
    );
  }
  // Escape metadata as literal text, independently of the user's Markdown.
  const literal = (value: string) => value.replace(/[&<>]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[character]!);
  return [
    report.reason,
    "",
    ...images.map((url, index) => `![Screenshot ${index + 1}](${url})`),
    ...(details.length ? ["", "<details>", "<summary>Technical details</summary>", "", "<pre>", ...details.map(literal), "</pre>", "</details>"] : []),
    "",
    `[View feedback in admin](https://app.fcsia.com/admin/feedback/${report._id})`,
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

function closedIssueStatus(stateReason: string | null | undefined): GithubFeedbackStatus {
  return stateReason === "not_planned" ? "DISMISSED" : "RESOLVED";
}

export function statusForGithubIssue(action: string, stateReason: string | null | undefined): GithubFeedbackStatus | null {
  if (action === "reopened") return "PENDING";
  if (action !== "closed") return null;
  return closedIssueStatus(stateReason);
}

/** The feedback status an issue fetched from the REST API shows now. */
export function issueSnapshot(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const issue = body as Record<string, unknown>;
  const githubUpdatedAt = typeof issue.updated_at === "string" ? Date.parse(issue.updated_at) : Number.NaN;
  if (Number.isNaN(githubUpdatedAt) || (issue.state !== "open" && issue.state !== "closed")) return null;
  const stateReason = typeof issue.state_reason === "string" ? issue.state_reason : undefined;
  return {
    status: issue.state === "open" ? ("PENDING" as const) : closedIssueStatus(stateReason),
    githubUpdatedAt,
    ...(stateReason ? { stateReason } : {}),
  };
}

export const loadPendingFeedback = internalQuery({
  args: { reportId: v.id("moderationReports") },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("moderationReports"),
      reason: v.string(),
      appVersion: v.optional(v.string()),
      clientMetadata: v.optional(feedbackMetadataValidator),
      images: v.array(v.object({ _id: v.id("feedbackReportImages"), storageId: v.id("_storage"), mimeType: v.string(), githubAssetUrl: v.optional(v.string()) })),
      githubIssueNumber: v.optional(v.number()),
    }),
  ),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (!report || report.contentType !== "GENERAL" || report.githubIssueNumber) return null;
    return {
      _id: report._id,
      reason: report.reason,
      appVersion: report.appVersion,
      clientMetadata: report.clientMetadata,
      images: (await ctx.db.query("feedbackReportImages").withIndex("by_reportId_and_createdAt", (q) => q.eq("reportId", report._id)).take(3)).map(({ _id, storageId, mimeType, githubAssetUrl }) => ({ _id, storageId, mimeType, githubAssetUrl })),
      githubIssueNumber: report.githubIssueNumber,
    };
  },
});

export const saveGithubAsset = internalMutation({
  args: { imageId: v.id("feedbackReportImages"), url: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.imageId, { githubAssetUrl: args.url });
    return null;
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
    // Staff may have decided before the issue existed; new issues open, so
    // carry any closing decision over.
    if (!isOpenFeedbackStatus(report.status)) {
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

const pushRoundResultValidator = v.union(
  v.object({
    kind: v.literal("sent"),
    status: feedbackStatusValidator,
    githubUpdatedAt: v.number(),
    seenStateUpdatedAt: v.optional(v.number()),
  }),
  v.object({ kind: v.literal("failed"), status: v.optional(feedbackStatusValidator) }),
  v.object({ kind: v.literal("abandoned") }),
);
type PushRoundResult = typeof pushRoundResultValidator.type;

/**
 * Records a push round and says whether the push goes on. The check runs in
 * the same transaction that renews or releases the lease, so a staff decision
 * either finds the push in flight (and is picked up here) or starts a new one.
 *
 * - `sent`: `githubUpdatedAt` is the issue's `updated_at` after our PATCH, so
 *   later-arriving echoes of it count as older events. The push is finished
 *   only if the report still has the status that was sent and no GitHub change
 *   at or after the PATCH was recorded during the round (it was ignored, so it
 *   must be overwritten; one in the same whole second cannot be ordered, so it
 *   counts too). `seenStateUpdatedAt` is the stored time when the round read
 *   the report, so only a change during the round counts.
 * - `failed`: the request failed. A status set after the attempt was left to
 *   this push, so the push continues in a fresh run; otherwise it ends. The
 *   app status stays authoritative and the issue keeps its old state.
 * - `abandoned`: there is no issue to update, or no credentials to update it.
 */
export const finishGithubIssuePushRound = internalMutation({
  args: {
    reportId: v.id("moderationReports"),
    result: pushRoundResultValidator,
  },
  returns: v.union(v.literal("done"), v.literal("continue")),
  handler: async (ctx, { reportId, result }) => {
    const report = await ctx.db.get(reportId);
    if (!report) return "done";
    const lease = (done: boolean) => ({ githubIssuePushingSince: done ? undefined : Date.now() });
    if (result.kind === "abandoned") {
      await ctx.db.patch(report._id, lease(true));
      return "done";
    }
    if (result.kind === "failed") {
      const done = result.status === undefined || sameGithubIssueState(report.status, result.status);
      await ctx.db.patch(report._id, lease(done));
      return done ? "done" : "continue";
    }
    const stored = report.githubIssueStateUpdatedAt;
    const newerGithubChange =
      stored !== undefined &&
      stored !== result.seenStateUpdatedAt &&
      stored >= result.githubUpdatedAt;
    const done = sameGithubIssueState(report.status, result.status) && !newerGithubChange;
    await ctx.db.patch(report._id, {
      ...lease(done),
      ...((stored ?? 0) < result.githubUpdatedAt
        ? { githubIssueStateUpdatedAt: result.githubUpdatedAt }
        : {}),
      // The issue now shows the staff decision; GitHub's clock orders what follows.
      ...(done ? { githubIssueDecidedAt: undefined } : {}),
    });
    return done ? "done" : "continue";
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
    const finish = (result: PushRoundResult) =>
      ctx.runMutation(internal.moderation.feedbackGithub.finishGithubIssuePushRound, {
        reportId: args.reportId,
        result,
      });
    // The pause caps the PATCH rate if a push ever fails to settle.
    const handOff = () =>
      ctx.scheduler.runAfter(PUSH_HANDOFF_DELAY_MS, internal.moderation.feedbackGithub.pushGithubIssueState, args);
    let attempted: FeedbackStatus | undefined;
    try {
      let token: string | null | undefined;
      for (let round = 0; round < MAX_PUSH_ROUNDS; round += 1) {
        const current = await ctx.runQuery(internal.moderation.feedbackGithub.loadGithubIssueState, args);
        if (!current) {
          await finish({ kind: "abandoned" });
          return null;
        }
        attempted = current.status;
        token ??= await feedbackGithubToken(ctx);
        if (!token) {
          await finish({ kind: "abandoned" });
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
          console.warn(`GitHub issue #${current.issueNumber} state update failed (${response.status})`);
          if ((await finish({ kind: "failed", status: current.status })) === "continue") await handOff();
          return null;
        }
        const body: unknown = await response.json().catch(() => null);
        const next = await finish({
          kind: "sent",
          status: current.status,
          githubUpdatedAt: issueUpdatedAt(body) ?? sentAt,
          ...(current.stateUpdatedAt !== undefined ? { seenStateUpdatedAt: current.stateUpdatedAt } : {}),
        });
        if (next === "done") return null;
      }
    } catch (error) {
      console.warn(`GitHub issue state push failed: ${error instanceof Error ? error.message : String(error)}`);
      const next = await finish({
        kind: "failed",
        ...(attempted !== undefined ? { status: attempted } : {}),
      }).catch(() => "done" as const);
      if (next === "continue") await handOff();
      return null;
    }
    // Staff kept changing the status; continue in a fresh run so the issue
    // still ends on the latest decision.
    await handOff();
    return null;
  },
});

/**
 * Settles a GitHub event that could not be ordered by time: it carried the
 * same whole-second `updated_at` as the newest issue state the app knew, so it
 * may have come before or after that state. Fetching the issue shows which one
 * GitHub kept.
 */
export const reconcileGithubIssueState = internalAction({
  args: { reportId: v.id("moderationReports"), tiedAt: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const current = await ctx.runQuery(internal.moderation.feedbackGithub.loadGithubIssueState, {
      reportId: args.reportId,
    });
    if (!current) return null;
    try {
      const token = await feedbackGithubToken(ctx);
      if (!token) return null;
      const response = await fetch(
        `https://api.github.com/repos/${GITHUB_REPOSITORY}/issues/${current.issueNumber}`,
        { headers: githubHeaders(token), signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS) },
      );
      if (!response.ok) throw new Error(`lookup failed (${response.status})`);
      const snapshot = issueSnapshot(await response.json());
      if (!snapshot) throw new Error("invalid issue response");
      await ctx.runMutation(internal.moderation.feedbackGithub.applyGithubIssueSnapshot, {
        reportId: args.reportId,
        issueNumber: current.issueNumber,
        tiedAt: args.tiedAt,
        ...snapshot,
      });
    } catch (error) {
      console.warn(
        `GitHub issue #${current.issueNumber} reconcile failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    return null;
  },
});

export const syncFeedbackIssue = internalAction({
  args: { reportId: v.id("moderationReports") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.runQuery(internal.moderation.feedbackGithub.loadPendingFeedback, args);
    if (!report) return null;

    try {
      const token = await feedbackGithubToken(ctx);
      if (!token) {
        await ctx.runMutation(internal.moderation.feedbackGithub.saveGithubIssueFailure, {
          reportId: args.reportId,
          error: "GitHub Feedback App is not configured",
        });
        return null;
      }

      const images: string[] = [];
      if (report.images.length) {
        const uploadToken = env.GITHUB_FEEDBACK_TOKEN;
        if (!uploadToken) throw new Error("GITHUB_FEEDBACK_TOKEN is required to upload screenshots");
        const repositoryResponse = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}`, {
          headers: githubHeaders(uploadToken), signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS),
        });
        if (!repositoryResponse.ok) throw new Error(`GitHub repository lookup failed (${repositoryResponse.status})`);
        const repository: unknown = await repositoryResponse.json();
        if (!repository || typeof repository !== "object" || !("id" in repository) || typeof repository.id !== "number") throw new Error("Invalid GitHub repository response");
        for (const [index, image] of report.images.entries()) {
          if (image.githubAssetUrl) { images.push(image.githubAssetUrl); continue; }
          const blob = await ctx.storage.get(image.storageId);
          if (!blob) throw new Error("Feedback screenshot is unavailable");
          const extension = image.mimeType.split("/")[1];
          const url = new URL("https://uploads.github.com/user-attachments/assets");
          url.searchParams.set("repository_id", String(repository.id));
          url.searchParams.set("name", `feedback-${index + 1}.${extension}`);
          url.searchParams.set("content_type", image.mimeType);
          const upload = await fetch(url, {
            method: "POST", headers: { ...githubHeaders(uploadToken), "Content-Type": "application/octet-stream" },
            body: blob, signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS),
          });
          if (!upload.ok) throw new Error(`GitHub screenshot upload failed (${upload.status})`);
          const asset: unknown = await upload.json();
          if (!asset || typeof asset !== "object" || !("url" in asset) || typeof asset.url !== "string" || !/^https:\/\/github\.com\/user-attachments\/assets\/[a-zA-Z0-9-]+$/.test(asset.url)) throw new Error("Invalid GitHub screenshot URL");
          await ctx.runMutation(internal.moderation.feedbackGithub.saveGithubAsset, { imageId: image._id, url: asset.url });
          images.push(asset.url);
        }
      }
      const response = await fetch(`https://api.github.com/repos/${GITHUB_REPOSITORY}/issues`, {
        method: "POST",
        headers: { ...githubHeaders(token), "Content-Type": "application/json" },
        body: JSON.stringify({ title: issueTitle(report.reason), body: issueBody(report, images) }),
        signal: AbortSignal.timeout(PUSH_REQUEST_TIMEOUT_MS),
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
    status: githubFeedbackStatusValidator,
    githubUpdatedAt: v.number(),
    stateReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db
      .query("moderationReports")
      .withIndex("by_githubIssueNumber", (q) => q.eq("githubIssueNumber", args.issueNumber))
      .unique();
    if (!report || report.contentType !== "GENERAL") return null;
    const known = report.githubIssueStateUpdatedAt;
    // Older than an issue state already accounted for: a redelivery, or the
    // echo of an earlier push.
    if (known !== undefined && args.githubUpdatedAt < known) return null;
    const keepStatus = async () => {
      if (known === undefined || args.githubUpdatedAt > known) {
        await ctx.db.patch(report._id, { githubIssueStateUpdatedAt: args.githubUpdatedAt });
      }
      return null;
    };
    // GitHub agreeing with the current status (including the echo of a staff
    // change pushed to the issue) must not replace the staff review note. An
    // open issue agrees with feedback that is in review.
    if (sameGithubIssueState(report.status, args.status)) return keepStatus();
    // While a push is mirroring the app's status onto the issue, a disagreeing
    // event is either the echo of an earlier push or a change that push is
    // about to overwrite, so the app's status stands.
    if (isPushInFlight(report, Date.now())) return keepStatus();
    if (report.githubIssueDecidedAt !== undefined) {
      // A staff decision whose push failed, so GitHub's timeline lacks it.
      // Only the two clocks can order them; anything up to it counts as older.
      if (args.githubUpdatedAt <= report.githubIssueDecidedAt) return keepStatus();
    } else if (args.githubUpdatedAt === known) {
      // The issue last matched the app in this same whole second, and this
      // event may come from before or after that. Ask GitHub which state won.
      await ctx.scheduler.runAfter(
        ISSUE_RECONCILE_DELAY_MS,
        internal.moderation.feedbackGithub.reconcileGithubIssueState,
        { reportId: report._id, tiedAt: known },
      );
      return null;
    }
    await applyGithubStatus(ctx, report, args);
    return null;
  },
});

/**
 * Applies the issue's state as fetched by `reconcileGithubIssueState`, unless
 * something newer settled the status first: another GitHub event, a push, or
 * a staff decision.
 */
export const applyGithubIssueSnapshot = internalMutation({
  args: {
    reportId: v.id("moderationReports"),
    issueNumber: v.number(),
    tiedAt: v.number(),
    status: githubFeedbackStatusValidator,
    githubUpdatedAt: v.number(),
    stateReason: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const report = await ctx.db.get(args.reportId);
    if (
      !report ||
      report.contentType !== "GENERAL" ||
      report.githubIssueNumber !== args.issueNumber ||
      report.githubIssueStateUpdatedAt !== args.tiedAt ||
      report.githubIssueDecidedAt !== undefined ||
      isPushInFlight(report, Date.now())
    ) {
      return null;
    }
    if (sameGithubIssueState(report.status, args.status)) {
      if (args.githubUpdatedAt > args.tiedAt) {
        await ctx.db.patch(report._id, { githubIssueStateUpdatedAt: args.githubUpdatedAt });
      }
      return null;
    }
    await applyGithubStatus(ctx, report, args);
    return null;
  },
});

/** Makes a GitHub issue state change the report's status. */
async function applyGithubStatus(
  ctx: MutationCtx,
  report: Doc<"moderationReports">,
  change: { issueNumber: number; status: GithubFeedbackStatus; githubUpdatedAt: number; stateReason?: string },
) {
  const reviewNote =
    change.status === "PENDING"
      ? `GitHub issue #${change.issueNumber} was reopened.`
      : change.status === "DISMISSED"
        ? `GitHub issue #${change.issueNumber} was closed as not planned.`
        : `GitHub issue #${change.issueNumber} was closed as completed.`;
  await ctx.db.patch(report._id, {
    status: change.status,
    reviewNote,
    reviewedAt: Date.now(),
    githubIssueStateUpdatedAt: Math.max(report.githubIssueStateUpdatedAt ?? 0, change.githubUpdatedAt),
    // This change is newer than any staff decision the issue did not show.
    githubIssueDecidedAt: undefined,
  });

  if (report.status !== "RESOLVED" && change.status === "RESOLVED") {
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
    meta: { issueNumber: change.issueNumber, status: change.status, stateReason: change.stateReason },
  });
}

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
