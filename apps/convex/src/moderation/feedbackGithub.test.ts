/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { statusForGithubIssue } from "./feedbackGithub";

vi.mock("../../lib/currentUser", async (importOriginal) => {
  const original = await importOriginal<typeof import("../../lib/currentUser")>();
  return {
    ...original,
    getCurrentAppUser: async (ctx: QueryCtx) => {
      const identity = await ctx.auth.getUserIdentity();
      if (!identity) throw new Error("Unauthenticated");
      const user = await ctx.db.get(identity.subject as Id<"users">);
      if (!user) throw new Error("Unauthenticated");
      return user;
    },
  };
});

const modules = import.meta.glob("/src/**/*.*s");
const webhookSecret = "synthetic-feedback-webhook-secret";

afterEach(() => {
  vi.unstubAllEnvs();
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

function issueEvent(repository = "virajdas/ia-app") {
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
      githubIssueSyncError: "GITHUB_FEEDBACK_TOKEN is not configured",
    });
  });
});
