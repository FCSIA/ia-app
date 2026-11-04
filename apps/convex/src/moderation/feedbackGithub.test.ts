/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { statusForGithubIssue } from "./feedbackGithub";
import { canRetryGithubSync, GITHUB_SYNC_STALE_MS } from "../../../shared/feedback-sync";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  return {
    ...original,
    getMaybeCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      return identity ? ctx.db.get(identity.subject as Id<"users">) : null;
    },
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      const user = await ctx.db.get(identity.subject as Id<"users">);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});

// Keep issue-sync tests focused on sync; App JWT authentication has its own suite.
vi.mock("./feedbackGithubToken", () => ({
  feedbackGithubToken: async () => process.env.GITHUB_FEEDBACK_TOKEN ?? null,
}));

const modules = import.meta.glob("/src/**/*.*s");
const webhookSecret = "synthetic-feedback-webhook-secret";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function fixture(contentType = "GENERAL") {
  const t = convexTest(schema, modules);
  const userId = await t.run((ctx) => ctx.db.insert("users", {
    uniqueId: "FEEDBACK-STUDENT",
    firstName: "Test",
    lastName: "Student",
    roles: ["STUDENT"],
    isStudent: true,
    isTeacherStaff: false,
    isStudentAdmin: false,
    isOtherRole: false,
    isActive: true,
    mustResetPassword: false,
    dashboardLayout: [],
    searchText: "test student",
    createdAt: 1,
    updatedAt: 1,
  }));
  const reportId = await t.run((ctx) => ctx.db.insert("moderationReports", {
    submitterId: userId,
    contentType,
    contentId: "synthetic-feedback",
    reason: "Synthetic feedback for webhook verification.",
    status: "PENDING",
    isEscalated: false,
    githubIssueNumber: 123,
    githubIssueSyncState: "SYNCED",
    createdAt: 1,
  }));
  return { t, userId, reportId, student: t.withIdentity({ subject: userId }) };
}

async function signature(body: string) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(webhookSecret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return `sha256=${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function issueEvent(repository = "FCSIA/ia-app") {
  return JSON.stringify({
    action: "closed",
    repository: { full_name: repository },
    issue: { number: 123, state_reason: "not_planned", updated_at: "2026-10-15T12:00:00Z" },
  });
}

async function webhook(t: ReturnType<typeof convexTest>, body: string, suppliedSignature?: string) {
  return t.fetch("/github/feedback-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "issues",
      "x-hub-signature-256": suppliedSignature ?? await signature(body),
    },
    body,
  });
}

describe("GitHub feedback issue state mapping", () => {
  it("maps GitHub completion and not-planned closures to feedback states", () => {
    expect(statusForGithubIssue("closed", "completed")).toBe("RESOLVED");
    expect(statusForGithubIssue("closed", "not_planned")).toBe("DISMISSED");
  });

  it("returns feedback to pending when the issue reopens", () => {
    expect(statusForGithubIssue("reopened", null)).toBe("PENDING");
  });

  it("ignores non-state issue events and unknown closure reasons default to resolved", () => {
    expect(statusForGithubIssue("edited", null)).toBeNull();
    expect(statusForGithubIssue("closed", undefined)).toBe("RESOLVED");
  });
});

describe("GitHub feedback webhook", () => {
  it("rejects missing configuration and forged signatures without changing feedback", async () => {
    const { t, reportId } = await fixture();
    vi.stubEnv("GITHUB_FEEDBACK_WEBHOOK_SECRET", undefined);
    expect((await webhook(t, issueEvent())).status).toBe(503);
    vi.stubEnv("GITHUB_FEEDBACK_WEBHOOK_SECRET", webhookSecret);
    expect((await webhook(t, issueEvent(), "sha256=forged")).status).toBe(401);
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });

  it("authenticates the exact body and ignores signed events from another repository", async () => {
    const { t, reportId } = await fixture();
    vi.stubEnv("GITHUB_FEEDBACK_WEBHOOK_SECRET", webhookSecret);
    const body = issueEvent();
    const signed = await signature(body);
    expect((await webhook(t, `${body} `, signed)).status).toBe(401);
    expect((await webhook(t, issueEvent("another/repository"))).status).toBe(204);
    expect((await webhook(t, issueEvent("virajdas/ia-app"))).status).toBe(204);
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });

  it("accepts a signed close, ignores duplicate and older events, and applies a newer reopen", async () => {
    const { t, reportId } = await fixture();
    vi.stubEnv("GITHUB_FEEDBACK_WEBHOOK_SECRET", webhookSecret);
    const body = issueEvent();
    expect((await webhook(t, body)).status).toBe(204);
    const closed = await t.run((ctx) => ctx.db.get(reportId));
    expect(closed?.status).toBe("DISMISSED");
    expect((await webhook(t, body)).status).toBe(204);
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 123, status: "PENDING", githubUpdatedAt: closed!.githubIssueStateUpdatedAt! - 1,
    });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toEqual(closed);
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 123, status: "PENDING", githubUpdatedAt: closed!.githubIssueStateUpdatedAt! + 1,
    });
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });

  it("classifies GitHub resolutions as feedback notifications", async () => {
    const { t, userId } = await fixture();
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 123, status: "RESOLVED", githubUpdatedAt: 10,
    });
    const rows = await t.run((ctx) => ctx.db.query("notificationDeliveries")
      .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId)).collect());
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ category: "FEEDBACK", title: "Your feedback was resolved" });
  });

  it("does not update a moderation report that is not general feedback", async () => {
    const { t, reportId } = await fixture("ANNOUNCEMENT");
    vi.stubEnv("GITHUB_FEEDBACK_WEBHOOK_SECRET", webhookSecret);
    expect((await webhook(t, issueEvent())).status).toBe(204);
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });

  it("rejects signed malformed JSON", async () => {
    const { t } = await fixture();
    vi.stubEnv("GITHUB_FEEDBACK_WEBHOOK_SECRET", webhookSecret);
    expect((await webhook(t, "{")).status).toBe(400);
  });
});

describe("GitHub feedback retries", () => {
  it("denies anonymous and student retries before touching the report", async () => {
    const { t, student, reportId } = await fixture();
    await t.run((ctx) => ctx.db.patch(reportId, { githubIssueNumber: undefined, githubIssueSyncState: "FAILED" }));
    await expect(t.mutation(api.moderation.reports.retryGithubIssueSync, { reportId })).rejects.toThrow("Unauthenticated");
    await expect(student.mutation(api.moderation.reports.retryGithubIssueSync, { reportId })).rejects.toThrow("Forbidden");
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.githubIssueSyncState).toBe("FAILED");
  });

  it("allows a super admin to queue one retry and records a missing-token failure", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", undefined);
    const { t, userId, reportId } = await fixture();
    await t.run(async (ctx) => {
      await ctx.db.patch(userId, { roles: ["SUPER_ADMIN"] });
      await ctx.db.patch(reportId, { githubIssueNumber: undefined, githubIssueSyncState: "FAILED" });
    });
    const admin = t.withIdentity({ subject: userId });
    expect(await admin.mutation(api.moderation.reports.retryGithubIssueSync, { reportId })).toEqual({ success: true });
    await expect(admin.mutation(api.moderation.reports.retryGithubIssueSync, { reportId })).rejects.toThrow("already queued");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      githubIssueSyncState: "FAILED",
      githubIssueSyncError: "GitHub Feedback App is not configured",
    });
  });
});

describe("GitHub feedback issue creation", () => {
  it("creates one issue with feedback text and no submitter identity", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-feedback-token");
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(Response.json({
      number: 456,
      html_url: "https://github.com/FCSIA/ia-app/issues/456",
    }, { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, reportId } = await fixture();
    await t.run((ctx) => ctx.db.patch(reportId, {
      githubIssueNumber: undefined, githubIssueSyncState: "PENDING",
    }));

    await t.action(internal.moderation.feedbackGithub.syncFeedbackIssue, { reportId });
    await t.action(internal.moderation.feedbackGithub.syncFeedbackIssue, { reportId });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.github.com/repos/FCSIA/ia-app/issues");
    expect(request?.method).toBe("POST");
    expect(request?.headers).toMatchObject({ Authorization: "Bearer synthetic-feedback-token" });
    const payload = JSON.parse(String(request?.body));
    expect(Object.keys(payload).sort()).toEqual(["body", "title"]);
    expect(payload.body).toContain("Synthetic feedback for webhook verification.");
    expect(payload.body).not.toContain("FEEDBACK-STUDENT");
    expect(payload.body).not.toContain("Test Student");
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      githubIssueNumber: 456,
      githubIssueUrl: "https://github.com/FCSIA/ia-app/issues/456",
      githubIssueSyncState: "SYNCED",
      githubIssueSyncError: null,
    });
  });

  it("records a GitHub API failure while retaining the feedback", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-feedback-token");
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 403 })));
    const { t, reportId } = await fixture();
    await t.run((ctx) => ctx.db.patch(reportId, {
      githubIssueNumber: undefined, githubIssueSyncState: "PENDING",
    }));
    await t.action(internal.moderation.feedbackGithub.syncFeedbackIssue, { reportId });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      status: "PENDING",
      githubIssueSyncState: "FAILED",
      githubIssueSyncError: "GitHub issue creation failed (403)",
    });
  });

  it("does not send moderation reports to GitHub", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-feedback-token");
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const { t, reportId } = await fixture("ANNOUNCEMENT");
    await t.run((ctx) => ctx.db.patch(reportId, { githubIssueNumber: undefined }));
    await t.action(internal.moderation.feedbackGithub.syncFeedbackIssue, { reportId });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("staff and GitHub status coordination", () => {
  async function superAdminFixture() {
    const ctx = await fixture();
    await ctx.t.run((db) => db.db.patch(ctx.userId, { roles: ["SUPER_ADMIN"] }));
    return { ...ctx, admin: ctx.t.withIdentity({ subject: ctx.userId }) };
  }

  it("keeps a staff decision when an older GitHub event arrives later", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", undefined);
    const { t, admin, reportId } = await superAdminFixture();
    await admin.mutation(api.moderation.reports.update, {
      reportId,
      status: "RESOLVED",
      reviewNote: "Fixed in the latest release.",
    });
    const decided = await t.run((ctx) => ctx.db.get(reportId));
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 123,
      status: "PENDING",
      githubUpdatedAt: decided!.githubIssueStateUpdatedAt! - 60_000,
    });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      status: "RESOLVED",
      reviewNote: "Fixed in the latest release.",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("mirrors a staff decision to the GitHub issue without its echo replacing the note", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, admin, reportId } = await superAdminFixture();
    await admin.mutation(api.moderation.reports.update, {
      reportId,
      status: "DISMISSED",
      reviewNote: "Working as intended.",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/issues\/123$/);
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(String(init.body))).toEqual({ state: "closed", state_reason: "not_planned" });

    const decided = await t.run((ctx) => ctx.db.get(reportId));
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 123,
      status: "DISMISSED",
      githubUpdatedAt: decided!.githubIssueStateUpdatedAt! + 1_000,
    });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      status: "DISMISSED",
      reviewNote: "Working as intended.",
    });
  });

  it("runs one push for quick successive decisions and sends the latest", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, admin, reportId } = await superAdminFixture();
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    await admin.mutation(api.moderation.reports.update, { reportId, status: "DISMISSED", reviewNote: "Not planned." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const bodies = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)
      .map(([, init]) => JSON.parse(String(init.body)));
    expect(bodies).toEqual([{ state: "closed", state_reason: "not_planned" }]);
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.githubIssuePushingSince).toBeUndefined();
  });

  it("keeps the newer decision while a push for an earlier one is in flight, however late its echo", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    let releaseFirst!: () => void;
    const firstHeld = new Promise<void>((resolve) => { releaseFirst = resolve; });
    let firstStarted!: () => void;
    const firstSeen = new Promise<void>((resolve) => { firstStarted = resolve; });
    const sent: unknown[] = [];
    const startedAt = Date.now();
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      if (sent.length === 1) {
        firstStarted();
        await firstHeld;
      }
      return Response.json({ updated_at: new Date(startedAt + sent.length * 60_000).toISOString() });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { t, admin, reportId } = await superAdminFixture();

    // The push for RESOLVED reads the report and is held mid-request.
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    vi.runOnlyPendingTimers();
    await firstSeen;
    // Staff change their mind while it is in flight; no second push starts.
    await admin.mutation(api.moderation.reports.update, { reportId, status: "DISMISSED", reviewNote: "Not planned." });
    // The stale close carries the first PATCH's updated_at, wherever it lands:
    // once while the push is still running and once (redelivered) long after.
    const staleClose = {
      issueNumber: 123,
      status: "RESOLVED" as const,
      githubUpdatedAt: startedAt + 60_000,
    };
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, staleClose);
    releaseFirst();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    vi.advanceTimersByTime(30 * 60_000);
    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, staleClose);

    const settled = await t.run((ctx) => ctx.db.get(reportId));
    expect(settled).toMatchObject({ status: "DISMISSED", reviewNote: "Not planned." });
    expect(settled?.githubIssuePushingSince).toBeUndefined();
    expect(sent).toEqual([
      { state: "closed", state_reason: "completed" },
      { state: "closed", state_reason: "not_planned" },
    ]);
  });

  it("applies a real GitHub change once the push has finished", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ updated_at: new Date(Date.now()).toISOString() })));
    const { t, admin, reportId } = await superAdminFixture();
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.githubIssuePushingSince).toBeUndefined();

    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 123,
      status: "PENDING",
      githubUpdatedAt: Date.now() + 30_000,
    });
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });

  it.each([
    ["matches", 0],
    ["runs 2s behind", 2_000],
  ])("settles in one PATCH when GitHub's whole-second clock %s Convex's", async (_label, githubLagMs) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T12:00:00.200Z"));
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => {
      // GitHub reports second precision and may run behind Convex's clock.
      const githubNow = Math.floor((Date.now() + 150 - githubLagMs) / 1000) * 1000;
      return Response.json({ updated_at: new Date(githubNow).toISOString() });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { t, admin, reportId } = await superAdminFixture();
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    expect(fetchMock).toHaveBeenCalledOnce();
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.githubIssuePushingSince).toBeUndefined();
  });

  it("overwrites a GitHub change that arrived while the push was finishing", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const { t, admin, reportId } = await superAdminFixture();
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      const patchedAt = Date.now() + sent.length * 60_000;
      if (sent.length === 1) {
        // Someone reopens the issue right after our close, before we finish.
        await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
          issueNumber: 123, status: "PENDING", githubUpdatedAt: patchedAt + 1_000,
        });
      }
      return Response.json({ updated_at: new Date(patchedAt).toISOString() });
    }));
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const settled = await t.run((ctx) => ctx.db.get(reportId));
    expect(settled?.status).toBe("RESOLVED");
    expect(settled?.githubIssuePushingSince).toBeUndefined();
    expect(sent).toEqual([
      { state: "closed", state_reason: "completed" },
      { state: "closed", state_reason: "completed" },
    ]);
  });

  it("releases the push when a request throws, so the next decision pushes again", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => { throw new Error("connection reset"); });
    vi.stubGlobal("fetch", fetchMock);
    const { t, admin, reportId } = await superAdminFixture();
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.githubIssuePushingSince).toBeUndefined();

    await admin.mutation(api.moderation.reports.update, { reportId, status: "DISMISSED", reviewNote: "Not planned." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("hands over to a fresh run when staff keep changing the status, and ends on the latest", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const { t, admin, reportId } = await superAdminFixture();
    const changes = ["DISMISSED", "PENDING", "RESOLVED", "DISMISSED"] as const;
    const sent: unknown[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init: RequestInit) => {
      sent.push(JSON.parse(String(init.body)));
      // Staff change the status while every request is in flight.
      const next = changes[sent.length - 1];
      if (next) await admin.mutation(api.moderation.reports.update, { reportId, status: next, reviewNote: next });
      return Response.json({});
    }));
    await admin.mutation(api.moderation.reports.update, { reportId, status: "RESOLVED", reviewNote: "Fixed." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const settled = await t.run((ctx) => ctx.db.get(reportId));
    expect(settled?.status).toBe("DISMISSED");
    expect(settled?.githubIssuePushingSince).toBeUndefined();
    expect(sent.length).toBeGreaterThan(3);
    expect(sent.at(-1)).toEqual({ state: "closed", state_reason: "not_planned" });
  });

  it("carries a decision made before the issue existed onto the new issue", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, admin, reportId } = await superAdminFixture();
    await t.run((ctx) => ctx.db.patch(reportId, {
      githubIssueNumber: undefined,
      githubIssueSyncState: "FAILED",
    }));
    await admin.mutation(api.moderation.reports.update, { reportId, status: "DISMISSED", reviewNote: "Duplicate." });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).not.toHaveBeenCalled();

    await t.mutation(internal.moderation.feedbackGithub.saveGithubIssue, {
      reportId, issueNumber: 456, issueUrl: "https://github.com/example/issues/456",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toMatch(/\/issues\/456$/);
    expect(JSON.parse(String(init.body))).toEqual({ state: "closed", state_reason: "not_planned" });
  });

  it("lets a super admin retry a sync that stopped without recording an outcome", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", undefined);
    const { t, admin, reportId } = await superAdminFixture();
    await t.run((ctx) => ctx.db.patch(reportId, {
      githubIssueNumber: undefined,
      githubIssueSyncState: "PENDING",
      githubIssueSyncQueuedAt: Date.now(),
    }));
    await expect(admin.mutation(api.moderation.reports.retryGithubIssueSync, { reportId }))
      .rejects.toThrow("already queued");
    vi.advanceTimersByTime(GITHUB_SYNC_STALE_MS);
    expect(await admin.mutation(api.moderation.reports.retryGithubIssueSync, { reportId }))
      .toEqual({ success: true });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("only offers a retry once a pending sync is stale", () => {
    const queuedAt = 1_000;
    expect(canRetryGithubSync({ githubIssueSyncState: "FAILED" }, queuedAt)).toBe(true);
    expect(canRetryGithubSync({ githubIssueSyncState: "PENDING", githubIssueSyncQueuedAt: queuedAt }, queuedAt + 1)).toBe(false);
    expect(canRetryGithubSync({ githubIssueSyncState: "PENDING", githubIssueSyncQueuedAt: queuedAt }, queuedAt + GITHUB_SYNC_STALE_MS)).toBe(true);
    expect(canRetryGithubSync({ githubIssueSyncState: "PENDING" }, queuedAt)).toBe(true);
    expect(canRetryGithubSync({ githubIssueSyncState: "SYNCED", githubIssueNumber: 7 }, queuedAt)).toBe(false);
  });
});


describe("feedback report links and screenshot publishing", () => {
  it("protects direct report lookup for guests, submitters, and ordinary admins", async () => {
    const { t, reportId, userId, student } = await fixture();
    expect(await t.query(api.moderation.reports.getFeedback, { reportId })).toBeNull();
    expect(await student.query(api.moderation.reports.getFeedback, { reportId })).toBeNull();
    await t.run((ctx) => ctx.db.patch(userId, { roles: ["ADMIN"] }));
    expect(await student.query(api.moderation.reports.getFeedback, { reportId })).toBeNull();
    await t.run((ctx) => ctx.db.patch(userId, { roles: ["SUPER_ADMIN"] }));
    expect(await student.query(api.moderation.reports.getFeedback, { reportId })).toMatchObject({ _id: reportId });
    expect(await student.query(api.moderation.reports.getFeedback, { reportId: "invalid" })).toBeNull();
    await t.run((ctx) => ctx.db.patch(userId, { roles: ["STUDENT"], canReviewFeedback: true }));
    expect(await student.query(api.moderation.reports.getFeedback, { reportId })).toMatchObject({ _id: reportId });
    await t.run((ctx) => ctx.db.patch(reportId, { contentType: "ANNOUNCEMENT" }));
    expect(await student.query(api.moderation.reports.getFeedback, { reportId })).toBeNull();
  });

  it("copies screenshots to GitHub and reuses the uploaded copy after issue creation fails", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-feedback-token");
    const { t, reportId } = await fixture();
    const imageId = await t.run(async (ctx) => {
      await ctx.db.patch(reportId, { githubIssueNumber: undefined, githubIssueSyncState: "PENDING", appVersion: "0.8.42" });
      const storageId = await ctx.storage.store(new Blob(["synthetic-image"], { type: "image/png" }));
      return ctx.db.insert("feedbackReportImages", { reportId, storageId, mimeType: "image/png", size: 15, createdAt: 1 });
    });
    const assetUrl = "https://github.com/user-attachments/assets/11111111-2222-3333-4444-555555555555";
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ id: 1234 }))
      .mockResolvedValueOnce(Response.json({ url: assetUrl }))
      .mockResolvedValueOnce(new Response("", { status: 503 }));
    vi.stubGlobal("fetch", fetchMock);
    await t.action(internal.moderation.feedbackGithub.syncFeedbackIssue, { reportId });
    expect(await t.run((ctx) => ctx.db.get(imageId))).toMatchObject({ githubAssetUrl: assetUrl });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({ githubIssueSyncState: "FAILED" });
    fetchMock.mockResolvedValueOnce(Response.json({ id: 1234 }))
      .mockResolvedValueOnce(Response.json({ number: 456, html_url: "https://github.com/FCSIA/ia-app/issues/456" }));
    await t.action(internal.moderation.feedbackGithub.syncFeedbackIssue, { reportId });
    expect(fetchMock).toHaveBeenCalledTimes(5);
    const issue = JSON.parse(String(fetchMock.mock.calls[4]![1]?.body));
    expect(issue.title).toBe("Synthetic feedback for webhook verification.");
    expect(issue.body).toContain(assetUrl);
    expect(issue.body).toContain(`/admin/feedback/${reportId}`);
    expect(issue.body).toContain("App: 0.8.42");
    expect(issue.body).not.toContain("Convex feedback record");
    expect(issue.body).not.toContain("Do not add");
  });
});
