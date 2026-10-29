/// <reference types="vite/client" />

import { convexTest } from "convex-test";
import { describe, expect, test, vi } from "vitest";
import aggregateTest from "@convex-dev/aggregate/test";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import schema from "../schema";
import { NO_CLUB_PERMISSIONS } from "./rolePermissions";

vi.mock("../../lib/currentUser", () => ({
  getCurrentAppUser: async (ctx: QueryCtx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    return ctx.db.get(identity.subject as Id<"users">);
  },
}));

const modules = import.meta.glob("/src/**/*.*s");

async function fixture() {
  const t = convexTest(schema, modules);
  aggregateTest.register(t, "volunteerHours");
  const ids = await t.run(async (ctx) => {
    const makeUser = (name: string) =>
      ctx.db.insert("users", {
        uniqueId: name,
        firstName: name,
        lastName: "Test",
        roles: ["STUDENT"],
        isStudent: true,
        isTeacherStaff: false,
        isStudentAdmin: false,
        isOtherRole: false,
        isActive: true,
        mustResetPassword: false,
        dashboardLayout: [],
        searchText: name,
        createdAt: 1,
        updatedAt: 1,
      });
    const studentId = await makeUser("Student");
    const reviewerId = await makeUser("Reviewer");
    const outsiderId = await makeUser("Outsider");
    const clubId = await ctx.db.insert("clubs", {
      name: "Service Club",
      joinPolicy: "OPEN",
      isActive: true,
      volunteerTrackingEnabled: true,
      createdAt: 1,
      updatedAt: 1,
    });
    const studentRoleId = await ctx.db.insert("clubRoles", {
      clubId,
      name: "Member",
      permissions: NO_CLUB_PERMISSIONS,
      createdById: studentId,
      createdAt: 1,
      updatedAt: 1,
    });
    const reviewerRoleId = await ctx.db.insert("clubRoles", {
      clubId,
      name: "Reviewer",
      permissions: { ...NO_CLUB_PERMISSIONS, reviewVolunteerHours: true },
      createdById: reviewerId,
      createdAt: 1,
      updatedAt: 1,
    });
    await ctx.db.insert("clubMembers", {
      clubId,
      userId: studentId,
      roleId: studentRoleId,
      joinedAt: 1,
    });
    await ctx.db.insert("clubMembers", {
      clubId,
      userId: reviewerId,
      roleId: reviewerRoleId,
      joinedAt: 1,
    });
    const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const storageId = await ctx.storage.store(
      new Blob([png], { type: "image/png" }),
    );
    const proofUploadId = await ctx.db.insert("volunteerProofUploads", {
      uploaderId: studentId,
      storageId,
      mimeType: "image/png",
      size: png.length,
      createdAt: 1,
    });
    return { studentId, reviewerId, outsiderId, clubId, proofUploadId };
  });
  return { t, ...ids };
}

describe("club volunteer hours", () => {
  test("requires club enablement, membership, and a proof owned by the submitter", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } =
      await fixture();
    const input = {
      clubId,
      activity: "Park cleanup",
      serviceDate: "2026-01-15",
      minutes: 120,
      proofUploadId,
    };
    await expect(
      t
        .withIdentity({ subject: outsiderId })
        .mutation(api.clubs.volunteering.submit, input),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: reviewerId })
        .mutation(api.clubs.volunteering.submit, input),
    ).rejects.toThrow(/Proof image not found/);
    await t.run((ctx) =>
      ctx.db.patch(clubId, { volunteerTrackingEnabled: false }),
    );
    await expect(
      t
        .withIdentity({ subject: studentId })
        .mutation(api.clubs.volunteering.submit, input),
    ).rejects.toThrow(/not enabled/);
    await t.run((ctx) =>
      ctx.db.patch(clubId, { volunteerTrackingEnabled: true }),
    );
    const logId = await t
      .withIdentity({ subject: studentId })
      .mutation(api.clubs.volunteering.submit, input);
    expect(logId).toBeTruthy();
    await expect(
      t
        .withIdentity({ subject: studentId })
        .mutation(api.clubs.volunteering.submit, input),
    ).rejects.toThrow(/Proof image not found/);
  });

  test("keeps logs private, rejects self-review, and counts hours only after approval", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } =
      await fixture();
    const student = t.withIdentity({ subject: studentId });
    const reviewer = t.withIdentity({ subject: reviewerId });
    const logId = await student.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "Library shelving",
      serviceDate: "2026-01-15",
      minutes: 150,
      proofUploadId,
    });
    expect(
      await student.query(api.clubs.volunteering.getMySummary, { clubId }),
    ).toMatchObject({
      approvedMinutes: 0,
      pendingMinutes: 150,
      pendingCount: 1,
    });
    const paginationOpts = { numItems: 20, cursor: null };
    expect(
      (
        await student.query(api.clubs.volunteering.listMine, {
          clubId,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
    await expect(
      student.query(api.clubs.volunteering.listPending, {
        clubId,
        paginationOpts,
      }),
    ).rejects.toThrow(/Not authorized/);
    await expect(
      t
        .withIdentity({ subject: outsiderId })
        .query(api.clubs.volunteering.listMine, { clubId, paginationOpts }),
    ).rejects.toThrow();
    await expect(
      t
        .withIdentity({ subject: outsiderId })
        .query(api.clubs.volunteering.getMySummary, { clubId }),
    ).rejects.toThrow(/Not a club member/);
    expect(
      (
        await reviewer.query(api.clubs.volunteering.listPending, {
          clubId,
          paginationOpts,
        })
      ).page,
    ).toHaveLength(1);
    await expect(
      student.mutation(api.clubs.volunteering.review, {
        clubId,
        logId,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(/Not authorized/);
    await reviewer.mutation(api.clubs.volunteering.review, {
      clubId,
      logId,
      decision: "APPROVED",
    });
    expect(
      await student.query(api.clubs.volunteering.getMySummary, { clubId }),
    ).toMatchObject({
      approvedMinutes: 150,
      approvedCount: 1,
      pendingMinutes: 0,
      pendingCount: 0,
    });
    await expect(
      reviewer.mutation(api.clubs.volunteering.review, {
        clubId,
        logId,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(/already been reviewed/);
  });

  test("requires a decline reason and prevents a permitted reviewer from approving their own entry", async () => {
    const { t, reviewerId, studentId, clubId } = await fixture();
    const reviewer = t.withIdentity({ subject: reviewerId });
    const student = t.withIdentity({ subject: studentId });
    const proofUploadId = await t.run(async (ctx) => {
      const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
      const storageId = await ctx.storage.store(
        new Blob([bytes], { type: "image/png" }),
      );
      return ctx.db.insert("volunteerProofUploads", {
        uploaderId: reviewerId,
        storageId,
        mimeType: "image/png",
        size: bytes.length,
        createdAt: 1,
      });
    });
    const logId = await reviewer.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "Food bank",
      serviceDate: "2026-01-15",
      minutes: 90,
      proofUploadId,
    });
    await expect(
      reviewer.mutation(api.clubs.volunteering.review, {
        clubId,
        logId,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(/own hours/);
    await expect(
      student.mutation(api.clubs.volunteering.review, {
        clubId,
        logId,
        decision: "DECLINED",
        note: "No proof",
      }),
    ).rejects.toThrow(/Not authorized/);
    await t.run(async (ctx) => {
      const membership = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", studentId),
        )
        .unique();
      await ctx.db.patch(membership!.roleId!, {
        permissions: { ...NO_CLUB_PERMISSIONS, reviewVolunteerHours: true },
      });
    });
    await expect(
      student.mutation(api.clubs.volunteering.review, {
        clubId,
        logId,
        decision: "DECLINED",
      }),
    ).rejects.toThrow(/Explain why/);
    await student.mutation(api.clubs.volunteering.review, {
      clubId,
      logId,
      decision: "DECLINED",
      note: "Hours need clarification",
    });
    expect(
      await reviewer.query(api.clubs.volunteering.getMySummary, { clubId }),
    ).toMatchObject({
      approvedMinutes: 0,
      pendingMinutes: 0,
      declinedCount: 1,
    });
  });

  test("serves proof only after a fresh authenticated club access check", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } =
      await fixture();
    const logId = await t
      .withIdentity({ subject: studentId })
      .mutation(api.clubs.volunteering.submit, {
        clubId,
        activity: "Campus cleanup",
        serviceDate: "2026-01-15",
        minutes: 60,
        proofUploadId,
      });
    const path = `/club-volunteer-proof?logId=${logId}`;
    expect((await t.fetch(path)).status).toBe(401);
    expect(
      (await t.withIdentity({ subject: outsiderId }).fetch(path)).status,
    ).toBe(404);
    expect(
      (await t.withIdentity({ subject: studentId }).fetch(path)).status,
    ).toBe(200);
    expect(
      (await t.withIdentity({ subject: reviewerId }).fetch(path)).status,
    ).toBe(200);
    await t.run((ctx) =>
      ctx.db.patch(clubId, { volunteerTrackingEnabled: false }),
    );
    expect(
      (await t.withIdentity({ subject: studentId }).fetch(path)).status,
    ).toBe(404);
  });
});

async function newProof(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  uploaderId: Id<"users">,
) {
  return t.run(async (ctx) => {
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0]);
    const storageId = await ctx.storage.store(
      new Blob([bytes], { type: "image/png" }),
    );
    return ctx.db.insert("volunteerProofUploads", {
      uploaderId,
      storageId,
      mimeType: "image/png",
      size: bytes.length,
      createdAt: Date.now(),
    });
  });
}

async function readyAnalytics(
  t: Awaited<ReturnType<typeof fixture>>["t"],
  clubId: Id<"clubs">,
) {
  await t.mutation(internal.clubs.volunteering.backfillAnalytics, {
    clubId,
    cursor: null,
  });
}

const pagination = { numItems: 1, cursor: null };

describe("volunteer reporting", () => {
  test("keeps exact member minutes and complete club totals across approvals and declines", async () => {
    const { t, studentId, reviewerId, clubId, proofUploadId } = await fixture();
    const student = t.withIdentity({ subject: studentId });
    const reviewer = t.withIdentity({ subject: reviewerId });
    await readyAnalytics(t, clubId);
    const first = await student.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "First service",
      serviceDate: "2026-01-15",
      minutes: 61,
      proofUploadId,
    });
    await student.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "Still pending",
      serviceDate: "2026-01-16",
      minutes: 29,
      proofUploadId: await newProof(t, studentId),
    });
    const declined = await reviewer.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "Reviewer service",
      serviceDate: "2026-01-15",
      minutes: 17,
      proofUploadId: await newProof(t, reviewerId),
    });
    await reviewer.mutation(api.clubs.volunteering.review, {
      clubId,
      logId: first,
      decision: "APPROVED",
    });
    await t.run(async (ctx) => {
      const member = await ctx.db
        .query("clubMembers")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", clubId).eq("userId", studentId),
        )
        .unique();
      await ctx.db.patch(member!.roleId!, {
        permissions: { ...NO_CLUB_PERMISSIONS, reviewVolunteerHours: true },
      });
    });
    await student.mutation(api.clubs.volunteering.review, {
      clubId,
      logId: declined,
      decision: "DECLINED",
      note: "Needs correction",
    });
    expect(
      await reviewer.query(api.clubs.volunteering.getClubSummary, { clubId }),
    ).toEqual({
      ready: true,
      volunteerCount: 2,
      approvedMinutes: 61,
      approvedCount: 1,
      pendingMinutes: 29,
      pendingCount: 1,
      declinedMinutes: 17,
      declinedCount: 1,
    });
    expect(
      await reviewer.query(api.clubs.volunteering.getMemberSummary, {
        clubId,
        userId: studentId,
      }),
    ).toMatchObject({
      userId: studentId,
      approvedMinutes: 61,
      pendingMinutes: 29,
      declinedMinutes: 0,
    });
    expect(
      await reviewer.query(api.clubs.volunteering.getMemberSummary, {
        clubId,
        userId: reviewerId,
      }),
    ).toMatchObject({
      userId: reviewerId,
      approvedMinutes: 0,
      pendingMinutes: 0,
      declinedMinutes: 17,
      declinedCount: 1,
    });
    await expect(
      reviewer.mutation(api.clubs.volunteering.review, {
        clubId,
        logId: first,
        decision: "APPROVED",
      }),
    ).rejects.toThrow(/already been reviewed/);
    expect(
      (await reviewer.query(api.clubs.volunteering.getClubSummary, { clubId }))
        .approvedMinutes,
    ).toBe(61);
    const history = await reviewer.query(api.clubs.volunteering.listHistory, {
      clubId,
      status: "DECLINED",
      userId: reviewerId,
      paginationOpts: pagination,
    });
    expect(history.page).toMatchObject([
      {
        _id: declined,
        reviewerName: "Student Test",
        reviewerNote: "Needs correction",
      },
    ]);
    expect(
      await reviewer.query(api.clubs.volunteering.getLog, {
        clubId,
        logId: first,
      }),
    ).toMatchObject({ status: "APPROVED", reviewerName: "Reviewer Test" });
  });

  test("denies reports and others' details to members, outsiders, and another club's reviewer", async () => {
    const { t, studentId, reviewerId, outsiderId, clubId, proofUploadId } =
      await fixture();
    const student = t.withIdentity({ subject: studentId });
    const outsider = t.withIdentity({ subject: outsiderId });
    const logId = await student.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "Private service",
      serviceDate: "2026-01-15",
      minutes: 60,
      proofUploadId,
    });
    for (const caller of [student, outsider, t]) {
      await expect(
        caller.query(api.clubs.volunteering.getClubSummary, { clubId }),
      ).rejects.toThrow();
      await expect(
        caller.query(api.clubs.volunteering.listMemberTotals, {
          clubId,
          paginationOpts: pagination,
        }),
      ).rejects.toThrow();
      await expect(
        caller.query(api.clubs.volunteering.listHistory, {
          clubId,
          paginationOpts: pagination,
        }),
      ).rejects.toThrow();
      await expect(
        caller.query(api.clubs.volunteering.getMemberSummary, {
          clubId,
          userId: studentId,
        }),
      ).rejects.toThrow();
      await expect(
        caller.mutation(api.clubs.volunteering.prepareAnalytics, { clubId }),
      ).rejects.toThrow();
    }
    const secondClubId = await t.run(async (ctx) => {
      const club = await ctx.db.insert("clubs", {
        name: "Other club",
        joinPolicy: "OPEN",
        isActive: true,
        volunteerTrackingEnabled: true,
        createdAt: 1,
        updatedAt: 1,
      });
      await ctx.db.insert("clubSponsors", {
        clubId: club,
        userId: outsiderId,
        addedAt: 1,
      });
      return club;
    });
    expect(
      (
        await outsider.query(api.clubs.volunteering.listHistory, {
          clubId: secondClubId,
          userId: studentId,
          paginationOpts: pagination,
        })
      ).page,
    ).toHaveLength(0);
    expect(
      await outsider.query(api.clubs.volunteering.getLog, {
        clubId: secondClubId,
        logId,
      }),
    ).toBeNull();
    await expect(
      outsider.query(api.clubs.volunteering.getLog, { clubId, logId }),
    ).rejects.toThrow();
    expect(
      await student.query(api.clubs.volunteering.getLog, { clubId, logId }),
    ).toMatchObject({ userId: studentId });
    const otherLog = await t
      .withIdentity({ subject: reviewerId })
      .mutation(api.clubs.volunteering.submit, {
        clubId,
        activity: "Other service",
        serviceDate: "2026-01-15",
        minutes: 15,
        proofUploadId: await newProof(t, reviewerId),
      });
    expect(
      await student.query(api.clubs.volunteering.getLog, {
        clubId,
        logId: otherLog,
      }),
    ).toBeNull();
  });

  test("backfills all old pages idempotently without showing incomplete totals", async () => {
    vi.useFakeTimers();
    try {
      const { t, studentId, reviewerId, clubId } = await fixture();
      const reviewer = t.withIdentity({ subject: reviewerId });
      await t.run(async (ctx) => {
        const storageId = await ctx.storage.store(
          new Blob([new Uint8Array([1])], { type: "image/png" }),
        );
        for (let i = 0; i < 57; i++)
          await ctx.db.insert("clubVolunteerLogs", {
            clubId,
            userId: studentId,
            activity: `Old service ${i}`,
            serviceDate: "2026-01-15",
            minutes: 7,
            proofStorageId: storageId,
            status: "DECLINED",
            submittedAt: i,
          });
        await ctx.db.insert("clubVolunteerTotals", {
          clubId,
          userId: studentId,
          approvedMinutes: 0,
          approvedCount: 0,
          pendingMinutes: 0,
          pendingCount: 0,
          declinedCount: 57,
        });
      });
      expect(
        (
          await reviewer.query(api.clubs.volunteering.getClubSummary, {
            clubId,
          })
        ).ready,
      ).toBe(false);
      await reviewer.mutation(api.clubs.volunteering.prepareAnalytics, {
        clubId,
      });
      await reviewer.mutation(api.clubs.volunteering.prepareAnalytics, {
        clubId,
      });
      await t.finishAllScheduledFunctions(vi.runAllTimers);
      expect(
        await reviewer.query(api.clubs.volunteering.getClubSummary, { clubId }),
      ).toMatchObject({
        ready: true,
        volunteerCount: 1,
        declinedMinutes: 399,
        declinedCount: 57,
      });
      const totals = await reviewer.query(
        api.clubs.volunteering.listMemberTotals,
        { clubId, paginationOpts: pagination },
      );
      expect(totals.page).toMatchObject([
        { userId: studentId, declinedMinutes: 399, declinedCount: 57 },
      ]);
      const first = await reviewer.query(api.clubs.volunteering.listHistory, {
        clubId,
        paginationOpts: { numItems: 20, cursor: null },
      });
      const second = await reviewer.query(api.clubs.volunteering.listHistory, {
        clubId,
        paginationOpts: { numItems: 20, cursor: first.continueCursor },
      });
      const third = await reviewer.query(api.clubs.volunteering.listHistory, {
        clubId,
        paginationOpts: { numItems: 20, cursor: second.continueCursor },
      });
      expect(first.page.length + second.page.length + third.page.length).toBe(
        57,
      );
      expect(third.isDone).toBe(true);
      await reviewer.mutation(api.clubs.volunteering.prepareAnalytics, {
        clubId,
      });
      expect(
        (
          await reviewer.query(api.clubs.volunteering.getClubSummary, {
            clubId,
          })
        ).declinedMinutes,
      ).toBe(399);
    } finally {
      vi.useRealTimers();
    }
  });
});

test("consumed proof cannot be restaged, discarded, or deleted by stale cleanup", async () => {
  const { t, studentId, clubId, proofUploadId } = await fixture();
  const student = t.withIdentity({ subject: studentId });
  const storageId = await t.run(
    async (ctx) => (await ctx.db.get(proofUploadId))!.storageId,
  );
  const uploadIntentId = await t.run((ctx) =>
    ctx.db.insert("uploadIntents", {
      uploaderId: studentId,
      purpose: "VOLUNTEER_PROOF",
      storageId,
      createdAt: 0,
      expiresAt: Date.now() + 3600000,
      claimedAt: Date.now(),
    }),
  );
  const logId = await student.mutation(api.clubs.volunteering.submit, {
    clubId,
    activity: "Evidence retention",
    serviceDate: "2026-01-15",
    minutes: 60,
    proofUploadId,
  });
  await expect(
    student.mutation(internal.uploads.files.finalizeVolunteerProofMutation, {
      uploadIntentId,
      storageId,
    }),
  ).rejects.toThrow(/already been submitted/);
  await student.mutation(internal.uploads.uploadIntents.discardRejectedUpload, {
    uploadIntentId,
    storageId,
  });
  const staleStage = await t.run((ctx) =>
    ctx.db.insert("volunteerProofUploads", {
      uploaderId: studentId,
      storageId,
      mimeType: "image/png",
      size: 9,
      createdAt: 1,
    }),
  );
  await expect(
    student.mutation(api.clubs.volunteering.submit, {
      clubId,
      activity: "Duplicate evidence",
      serviceDate: "2026-01-15",
      minutes: 60,
      proofUploadId: staleStage,
    }),
  ).rejects.toThrow(/already been submitted/);
  await t.mutation(
    internal.uploads.volunteerProofs.cleanupStagedVolunteerProof,
    { proofUploadId: staleStage },
  );
  expect(await t.run((ctx) => ctx.db.get(logId))).not.toBeNull();
  expect(
    await t.run((ctx) => ctx.db.system.get("_storage", storageId)),
  ).not.toBeNull();
});
