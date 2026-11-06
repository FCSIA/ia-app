/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { githubIssueStateFor, sameGithubIssueState } from "./feedbackGithub";
import { insertUser } from "../../test/fixtures";

vi.mock("../../lib/currentUser", async (original) =>
  (await import("../../test/auth")).currentUserFromIdentity(await original()),
);

vi.mock("./feedbackGithubToken", () => ({
  feedbackGithubToken: async () => process.env.GITHUB_FEEDBACK_TOKEN ?? null,
}));

const modules = import.meta.glob("/src/**/*.*s");

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

async function fixture() {
  const t = convexTest(schema, modules);
  const addUser = (uniqueId: string, extra: Partial<Doc<"users">>) =>
    t.run((ctx) => insertUser(ctx, { uniqueId, firstName: uniqueId, lastName: "User", roles: ["STUDENT"], ...extra }));
  const submitterId = await addUser("SUBMITTER", {});
  const otherStudentId = await addUser("OTHER", {});
  const firstAdminId = await addUser("FIRST-ADMIN", { roles: ["SUPER_ADMIN"] });
  const secondAdminId = await addUser("SECOND-ADMIN", { roles: ["SUPER_ADMIN"] });
  const adminId = await addUser("ADMIN", { roles: ["ADMIN"] });
  const reviewerId = await addUser("REVIEWER", { canReviewFeedback: true });
  // Shaped like a record written before IN_REVIEW existed.
  const reportId = await t.run((ctx) => ctx.db.insert("moderationReports", {
    submitterId,
    contentType: "GENERAL",
    contentId: "synthetic-feedback",
    reason: "Synthetic feedback for review workflow tests.",
    status: "PENDING",
    isEscalated: false,
    githubIssueNumber: 321,
    githubIssueSyncState: "SYNCED",
    createdAt: 1,
  }));
  const as = (id: Id<"users">) => t.withIdentity({ subject: id });
  return {
    t,
    reportId,
    submitterId,
    submitter: as(submitterId),
    otherStudent: as(otherStudentId),
    firstAdmin: as(firstAdminId),
    secondAdmin: as(secondAdminId),
    admin: as(adminId),
    reviewer: as(reviewerId),
  };
}

const notificationsFor = (
  t: Awaited<ReturnType<typeof fixture>>["t"],
  userId: Id<"users">,
) =>
  t.run((ctx) => ctx.db.query("notificationDeliveries")
    .withIndex("by_userId_and_createdAt", (q) => q.eq("userId", userId))
    .collect());

describe("feedback status to GitHub issue state", () => {
  it("keeps the issue open for new and in-review feedback", () => {
    expect(githubIssueStateFor("IN_REVIEW")).toEqual({ state: "open" });
    expect(sameGithubIssueState("PENDING", "IN_REVIEW")).toBe(true);
    expect(sameGithubIssueState("IN_REVIEW", "RESOLVED")).toBe(false);
    expect(sameGithubIssueState("RESOLVED", "DISMISSED")).toBe(false);
  });
});

describe("feedback in-review workflow", () => {
  it("starts a review without touching GitHub and tells the submitter", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, firstAdmin, reportId, submitterId } = await fixture();

    await firstAdmin.mutation(api.moderation.reports.update, {
      reportId, status: "IN_REVIEW", reviewNote: "", expectedStatus: "PENDING",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const report = await t.run((ctx) => ctx.db.get(reportId));
    expect(report).toMatchObject({ status: "IN_REVIEW", reviewNote: "" });
    expect(report?.reviewedAt).toBeUndefined();
    expect(report?.githubIssuePushingSince).toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
    const notifications = await notificationsFor(t, submitterId);
    expect(notifications).toHaveLength(1);
    expect(notifications[0]).toMatchObject({
      category: "FEEDBACK",
      title: "Your feedback is being reviewed",
      href: "/report",
    });
  });

  it("closes the GitHub issue when an in-review item is resolved", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", "synthetic-token");
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { t, firstAdmin, reportId, submitterId } = await fixture();
    await firstAdmin.mutation(api.moderation.reports.update, {
      reportId, status: "IN_REVIEW", reviewNote: "",
    });
    await firstAdmin.mutation(api.moderation.reports.update, {
      reportId, status: "RESOLVED", reviewNote: "Fixed.", expectedStatus: "IN_REVIEW",
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const bodies = (fetchMock.mock.calls as unknown as Array<[string, RequestInit]>)
      .map(([, init]) => JSON.parse(String(init.body)));
    expect(bodies).toEqual([{ state: "closed", state_reason: "completed" }]);
    const report = await t.run((ctx) => ctx.db.get(reportId));
    expect(report?.status).toBe("RESOLVED");
    expect(report?.reviewedAt).toEqual(expect.any(Number));
    expect((await notificationsFor(t, submitterId)).map((row) => row.title)).toEqual([
      "Your feedback is being reviewed",
      "Your feedback was resolved",
    ]);
  });

  it("treats a GitHub reopen as agreeing with in-review feedback, and a close as a decision", async () => {
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", undefined);
    const { t, reportId } = await fixture();
    await t.run((ctx) => ctx.db.patch(reportId, { status: "IN_REVIEW", reviewNote: "Looking." }));

    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 321, status: "PENDING", githubUpdatedAt: 10,
    });
    expect(await t.run((ctx) => ctx.db.get(reportId))).toMatchObject({
      status: "IN_REVIEW", reviewNote: "Looking.", githubIssueStateUpdatedAt: 10,
    });

    await t.mutation(internal.moderation.feedbackGithub.applyGithubIssueState, {
      issueNumber: 321, status: "DISMISSED", githubUpdatedAt: 20,
    });
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("DISMISSED");
  });

  it("refuses a decision based on a status another reviewer already changed", async () => {
    vi.useFakeTimers();
    vi.stubEnv("GITHUB_FEEDBACK_TOKEN", undefined);
    const { t, firstAdmin, secondAdmin, reportId } = await fixture();
    // Both reviewers loaded the item while it was new.
    const results = await Promise.allSettled([
      firstAdmin.mutation(api.moderation.reports.update, {
        reportId, status: "RESOLVED", reviewNote: "Fixed.", expectedStatus: "PENDING",
      }),
      secondAdmin.mutation(api.moderation.reports.update, {
        reportId, status: "IN_REVIEW", reviewNote: "", expectedStatus: "PENDING",
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(String((rejected as PromiseRejectedResult).reason)).toContain(
      "updated by someone else",
    );
    const report = await t.run((ctx) => ctx.db.get(reportId));
    expect(["RESOLVED", "IN_REVIEW"]).toContain(report?.status);
    // The surviving update is intact rather than a mix of both.
    expect(report?.reviewNote).toBe(report?.status === "RESOLVED" ? "Fixed." : "");
    await t.finishAllScheduledFunctions(vi.runAllTimers);
  });

  it("denies status changes to callers who are not super admins", async () => {
    const { t, reportId, submitter, otherStudent, admin, reviewer } = await fixture();
    const update = { reportId, status: "IN_REVIEW" as const, reviewNote: "" };
    await expect(t.mutation(api.moderation.reports.update, update)).rejects.toThrow("Unauthenticated");
    for (const caller of [submitter, otherStudent, admin, reviewer]) {
      await expect(caller.mutation(api.moderation.reports.update, update)).rejects.toThrow("Forbidden");
    }
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });

  it("does not allow moderation reports to be marked in review", async () => {
    const { t, reportId, firstAdmin } = await fixture();
    await t.run((ctx) => ctx.db.patch(reportId, { contentType: "ANNOUNCEMENT" }));
    await expect(firstAdmin.mutation(api.moderation.reports.update, {
      reportId, status: "IN_REVIEW", reviewNote: "",
    })).rejects.toThrow("Only feedback can be marked in review");
    expect((await t.run((ctx) => ctx.db.get(reportId)))?.status).toBe("PENDING");
  });
});

describe("personal feedback history", () => {
  it("shows submitters their own feedback with its current status only", async () => {
    const { t, reportId, submitter, otherStudent, firstAdmin } = await fixture();
    await firstAdmin.mutation(api.moderation.reports.update, {
      reportId, status: "IN_REVIEW", reviewNote: "",
    });
    await firstAdmin.mutation(api.moderation.reports.addFeedbackResponse, {
      reportId, body: "Thanks, we can reproduce this.",
    });

    const history = await submitter.query(api.moderation.reports.listMyFeedback, {});
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      _id: reportId,
      status: "IN_REVIEW",
      responses: [{ body: "Thanks, we can reproduce this." }],
    });
    expect(history[0]).not.toHaveProperty("githubIssueNumber");
    expect(history[0]).not.toHaveProperty("submitterId");

    expect(await otherStudent.query(api.moderation.reports.listMyFeedback, {})).toEqual([]);
    expect(await t.query(api.moderation.reports.listMyFeedback, {})).toEqual([]);
    expect(await submitter.query(api.moderation.reports.listFeedback, {})).toEqual([]);
  });

  it("lists in-review feedback in the staff queue", async () => {
    const { reportId, firstAdmin, reviewer } = await fixture();
    await firstAdmin.mutation(api.moderation.reports.update, {
      reportId, status: "IN_REVIEW", reviewNote: "",
    });
    for (const caller of [firstAdmin, reviewer]) {
      const queue = await caller.query(api.moderation.reports.listFeedback, {});
      expect(queue.map((report) => [report._id, report.status])).toEqual([[reportId, "IN_REVIEW"]]);
    }
  });
});
