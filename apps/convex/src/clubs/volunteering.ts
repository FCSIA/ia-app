import {
  paginationOptsValidator,
  paginationResultValidator,
} from "convex/server";
import { ConvexError, v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";
import { internal } from "../_generated/api";
import { volunteerLogs, volunteerMembers } from "./volunteerAggregates";
import { displayName } from "../../../shared/user-name";
import type { Doc, Id } from "../_generated/dataModel";
import { getCurrentAppUser } from "../../lib/currentUser";
import { getClubContext } from "./access";
import { consumeVolunteerProof } from "../uploads/volunteerProofs";
import { logAuditEvent } from "../audit/_lib";

const logStatus = v.union(
  v.literal("PENDING"),
  v.literal("APPROVED"),
  v.literal("DECLINED"),
);
const logItem = v.object({
  _id: v.id("clubVolunteerLogs"),
  userId: v.id("users"),
  studentName: v.string(),
  activity: v.string(),
  serviceDate: v.string(),
  minutes: v.number(),
  notes: v.union(v.string(), v.null()),
  proofAvailable: v.boolean(),
  status: logStatus,
  submittedAt: v.number(),
  reviewedAt: v.union(v.number(), v.null()),
  reviewerNote: v.union(v.string(), v.null()),
  reviewerName: v.union(v.string(), v.null()),
});

function requireEnabled(context: Awaited<ReturnType<typeof getClubContext>>) {
  if (!context.club.isActive || !context.club.volunteerTrackingEnabled) {
    throw new ConvexError(
      "Volunteer-hours tracking is not enabled for this club",
    );
  }
}

function validateServiceDate(value: string, now: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ConvexError("Enter a valid service date");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getTime() > now ||
    date.getTime() < Date.UTC(2000, 0, 1)
  ) {
    throw new ConvexError("Service date must be a real date in the past");
  }
}

async function adjustTotals(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
  changes: Partial<
    Record<
      | "approvedMinutes"
      | "approvedCount"
      | "pendingMinutes"
      | "pendingCount"
      | "declinedCount",
      number
    >
  >,
) {
  const existing = await ctx.db
    .query("clubVolunteerTotals")
    .withIndex("by_clubId_and_userId", (q) =>
      q.eq("clubId", clubId).eq("userId", userId),
    )
    .unique();
  const base = existing ?? {
    approvedMinutes: 0,
    approvedCount: 0,
    pendingMinutes: 0,
    pendingCount: 0,
    declinedCount: 0,
  };
  const next = {
    approvedMinutes: base.approvedMinutes + (changes.approvedMinutes ?? 0),
    approvedCount: base.approvedCount + (changes.approvedCount ?? 0),
    pendingMinutes: base.pendingMinutes + (changes.pendingMinutes ?? 0),
    pendingCount: base.pendingCount + (changes.pendingCount ?? 0),
    declinedCount: base.declinedCount + (changes.declinedCount ?? 0),
  };
  if (existing) await ctx.db.patch(existing._id, next);
  else {
    const id = await ctx.db.insert("clubVolunteerTotals", {
      clubId,
      userId,
      ...next,
    });
    await volunteerMembers.insertIfDoesNotExist(ctx, (await ctx.db.get(id))!);
  }
}

export const getMySummary = query({
  args: { clubId: v.id("clubs") },
  returns: v.object({
    approvedMinutes: v.number(),
    approvedCount: v.number(),
    pendingMinutes: v.number(),
    pendingCount: v.number(),
    declinedCount: v.number(),
    canReview: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    requireEnabled(context);
    if (!context.isMember && !context.permissions.reviewVolunteerHours) {
      throw new ConvexError("Not authorized to view volunteer hours");
    }
    const totals = await ctx.db
      .query("clubVolunteerTotals")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", user._id),
      )
      .unique();
    return {
      approvedMinutes: totals?.approvedMinutes ?? 0,
      approvedCount: totals?.approvedCount ?? 0,
      pendingMinutes: totals?.pendingMinutes ?? 0,
      pendingCount: totals?.pendingCount ?? 0,
      declinedCount: totals?.declinedCount ?? 0,
      canReview: context.permissions.reviewVolunteerHours ?? false,
    };
  },
});

export const submit = mutation({
  args: {
    clubId: v.id("clubs"),
    activity: v.string(),
    serviceDate: v.string(),
    minutes: v.number(),
    notes: v.optional(v.string()),
    proofUploadId: v.id("volunteerProofUploads"),
  },
  returns: v.id("clubVolunteerLogs"),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    requireEnabled(context);
    if (!context.isMember)
      throw new ConvexError("Only club members can log volunteer hours");
    const activity = args.activity.trim();
    const notes = args.notes?.trim() || undefined;
    if (activity.length < 3 || activity.length > 120)
      throw new ConvexError("Activity must be 3–120 characters");
    if (notes && notes.length > 1000)
      throw new ConvexError("Notes must be 1,000 characters or fewer");
    if (
      !Number.isInteger(args.minutes) ||
      args.minutes < 1 ||
      args.minutes > 1440
    ) {
      throw new ConvexError("Hours must be between 1 minute and 24 hours");
    }
    const now = Date.now();
    validateServiceDate(args.serviceDate, now);
    const proofStorageId = await consumeVolunteerProof(
      ctx,
      args.proofUploadId,
      user._id,
    );
    const logId = await ctx.db.insert("clubVolunteerLogs", {
      clubId: args.clubId,
      userId: user._id,
      activity,
      serviceDate: args.serviceDate,
      minutes: args.minutes,
      notes,
      proofStorageId,
      status: "PENDING",
      submittedAt: now,
    });
    await volunteerLogs.insert(ctx, (await ctx.db.get(logId))!);
    await adjustTotals(ctx, args.clubId, user._id, {
      pendingMinutes: args.minutes,
      pendingCount: 1,
    });
    return logId;
  },
});

async function serializeLog(ctx: QueryCtx, log: Doc<"clubVolunteerLogs">) {
  const [student, reviewer] = await Promise.all([
    ctx.db.get(log.userId),
    log.reviewedById ? ctx.db.get(log.reviewedById) : null,
  ]);
  return {
    _id: log._id,
    userId: log.userId,
    studentName: student ? displayName(student) : "Former member",
    activity: log.activity,
    serviceDate: log.serviceDate,
    minutes: log.minutes,
    notes: log.notes ?? null,
    proofAvailable:
      (await ctx.db.system.get("_storage", log.proofStorageId)) !== null,
    status: log.status,
    submittedAt: log.submittedAt,
    reviewedAt: log.reviewedAt ?? null,
    reviewerNote: log.reviewerNote ?? null,
    reviewerName: reviewer ? displayName(reviewer) : null,
  };
}

export const listMine = query({
  args: { clubId: v.id("clubs"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(logItem),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    requireEnabled(context);
    if (!context.isMember)
      throw new ConvexError(
        "Only club members can view personal volunteer hours",
      );
    const results = await ctx.db
      .query("clubVolunteerLogs")
      .withIndex("by_clubId_and_userId_and_submittedAt", (q) =>
        q.eq("clubId", args.clubId).eq("userId", user._id),
      )
      .order("desc")
      .paginate(args.paginationOpts);
    return {
      ...results,
      page: await Promise.all(
        results.page.map((log) => serializeLog(ctx, log)),
      ),
    };
  },
});

export const listPending = query({
  args: { clubId: v.id("clubs"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(logItem),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    requireEnabled(context);
    if (!context.permissions.reviewVolunteerHours)
      throw new ConvexError("Not authorized to review volunteer hours");
    const results = await ctx.db
      .query("clubVolunteerLogs")
      .withIndex("by_clubId_and_status_and_submittedAt", (q) =>
        q.eq("clubId", args.clubId).eq("status", "PENDING"),
      )
      .order("asc")
      .paginate(args.paginationOpts);
    return {
      ...results,
      page: await Promise.all(
        results.page.map((log) => serializeLog(ctx, log)),
      ),
    };
  },
});

export const getLog = query({
  args: { clubId: v.id("clubs"), logId: v.id("clubVolunteerLogs") },
  returns: v.union(logItem, v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    requireEnabled(context);
    const log = await ctx.db.get(args.logId);
    if (!log || log.clubId !== args.clubId) return null;
    if (
      !context.permissions.reviewVolunteerHours &&
      (!context.isMember || log.userId !== user._id)
    )
      return null;
    return serializeLog(ctx, log);
  },
});

/** Used by the authenticated HTTP action; never exposes a bearer storage URL. */
export const getProofStorageId = internalQuery({
  args: { logId: v.id("clubVolunteerLogs") },
  returns: v.union(v.id("_storage"), v.null()),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const log = await ctx.db.get(args.logId);
    if (!log) return null;
    const context = await getClubContext(ctx, log.clubId, user);
    requireEnabled(context);
    if (log.userId !== user._id && !context.permissions.reviewVolunteerHours)
      return null;
    return log.proofStorageId;
  },
});

export const review = mutation({
  args: {
    clubId: v.id("clubs"),
    logId: v.id("clubVolunteerLogs"),
    decision: v.union(v.literal("APPROVED"), v.literal("DECLINED")),
    note: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    const context = await getClubContext(ctx, args.clubId, user);
    requireEnabled(context);
    if (!context.permissions.reviewVolunteerHours)
      throw new ConvexError("Not authorized to review volunteer hours");
    const log = await ctx.db.get(args.logId);
    if (!log || log.clubId !== args.clubId)
      throw new ConvexError("Volunteer log not found");
    if (log.status !== "PENDING")
      throw new ConvexError("This log has already been reviewed");
    if (log.userId === user._id)
      throw new ConvexError("You cannot review your own hours");
    const note = args.note?.trim() || undefined;
    if (note && note.length > 500)
      throw new ConvexError("Review note must be 500 characters or fewer");
    if (args.decision === "DECLINED" && !note)
      throw new ConvexError("Explain why the submission was declined");
    await ctx.db.patch(log._id, {
      status: args.decision,
      reviewedById: user._id,
      reviewedAt: Date.now(),
      reviewerNote: note,
    });
    await volunteerLogs.replaceOrInsert(ctx, log, (await ctx.db.get(log._id))!);
    await adjustTotals(ctx, args.clubId, log.userId, {
      pendingMinutes: -log.minutes,
      pendingCount: -1,
      ...(args.decision === "APPROVED"
        ? { approvedMinutes: log.minutes, approvedCount: 1 }
        : { declinedCount: 1 }),
    });
    await logAuditEvent(ctx, {
      actorId: user._id,
      action: "CLUB_UPDATED",
      entityType: "Club",
      entityId: args.clubId,
      meta: { volunteerLogId: log._id, decision: args.decision },
    });
    return null;
  },
});

const totalsFields = {
  approvedMinutes: v.number(),
  approvedCount: v.number(),
  pendingMinutes: v.number(),
  pendingCount: v.number(),
  declinedMinutes: v.number(),
  declinedCount: v.number(),
};
const memberFields = {
  userId: v.id("users"),
  studentName: v.string(),
  uniqueId: v.string(),
  ...totalsFields,
};

async function requireReviewer(
  ctx: QueryCtx | MutationCtx,
  clubId: Id<"clubs">,
) {
  const user = await getCurrentAppUser(ctx);
  const context = await getClubContext(ctx, clubId, user);
  requireEnabled(context);
  if (!context.permissions.reviewVolunteerHours)
    throw new ConvexError("Not authorized to review volunteer hours");
  return context;
}

/** All-time totals are independent of the number of loaded table rows. */
export const getClubSummary = query({
  args: { clubId: v.id("clubs") },
  returns: v.object({
    ready: v.boolean(),
    volunteerCount: v.number(),
    ...totalsFields,
  }),
  handler: async (ctx, args) => {
    const context = await requireReviewer(ctx, args.clubId);
    if (!context.club.volunteerAnalyticsReady) {
      return {
        ready: false,
        volunteerCount: 0,
        approvedMinutes: 0,
        approvedCount: 0,
        pendingMinutes: 0,
        pendingCount: 0,
        declinedMinutes: 0,
        declinedCount: 0,
      };
    }
    const namespace = `logs:${args.clubId}`;
    const results = await Promise.all(
      (["APPROVED", "PENDING", "DECLINED"] as const).map(async (status) => {
        const options = {
          namespace,
          bounds: { prefix: [status] as [typeof status] },
        };
        const [minutes, count] = await Promise.all([
          volunteerLogs.sum(ctx, options),
          volunteerLogs.count(ctx, options),
        ]);
        return { minutes, count };
      }),
    );
    return {
      ready: true,
      volunteerCount: await volunteerMembers.count(ctx, {
        namespace: `members:${args.clubId}`,
      }),
      approvedMinutes: results[0].minutes,
      approvedCount: results[0].count,
      pendingMinutes: results[1].minutes,
      pendingCount: results[1].count,
      declinedMinutes: results[2].minutes,
      declinedCount: results[2].count,
    };
  },
});

async function serializeMember(
  ctx: QueryCtx,
  clubId: Id<"clubs">,
  userId: Id<"users">,
  totals: Doc<"clubVolunteerTotals"> | null,
) {
  const user = await ctx.db.get(userId);
  return {
    userId,
    studentName: user ? displayName(user) : "Former member",
    uniqueId: user?.uniqueId ?? "",
    approvedMinutes: totals?.approvedMinutes ?? 0,
    approvedCount: totals?.approvedCount ?? 0,
    pendingMinutes: totals?.pendingMinutes ?? 0,
    pendingCount: totals?.pendingCount ?? 0,
    declinedCount: totals?.declinedCount ?? 0,
    declinedMinutes: await volunteerLogs.sum(ctx, {
      namespace: `logs:${clubId}`,
      bounds: { prefix: ["DECLINED", userId] },
    }),
  };
}

export const listMemberTotals = query({
  args: { clubId: v.id("clubs"), paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(
    v.object({ _id: v.id("clubVolunteerTotals"), ...memberFields }),
  ),
  handler: async (ctx, args) => {
    const context = await requireReviewer(ctx, args.clubId);
    if (!context.club.volunteerAnalyticsReady)
      throw new ConvexError("Volunteer analytics are still being prepared");
    const result = await ctx.db
      .query("clubVolunteerTotals")
      .withIndex("by_clubId_and_userId", (q) => q.eq("clubId", args.clubId))
      .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(
        result.page.map(async (row) => ({
          _id: row._id,
          ...(await serializeMember(ctx, args.clubId, row.userId, row)),
        })),
      ),
    };
  },
});

export const getMemberSummary = query({
  args: { clubId: v.id("clubs"), userId: v.id("users") },
  returns: v.object(memberFields),
  handler: async (ctx, args) => {
    const context = await requireReviewer(ctx, args.clubId);
    if (!context.club.volunteerAnalyticsReady)
      throw new ConvexError("Volunteer analytics are still being prepared");
    const totals = await ctx.db
      .query("clubVolunteerTotals")
      .withIndex("by_clubId_and_userId", (q) =>
        q.eq("clubId", args.clubId).eq("userId", args.userId),
      )
      .unique();
    if (!totals)
      throw new ConvexError(
        "No volunteer submissions for this member in this club",
      );
    return serializeMember(ctx, args.clubId, args.userId, totals);
  },
});

export const listHistory = query({
  args: {
    clubId: v.id("clubs"),
    userId: v.optional(v.id("users")),
    status: v.optional(logStatus),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(logItem),
  handler: async (ctx, args) => {
    await requireReviewer(ctx, args.clubId);
    const logs = ctx.db.query("clubVolunteerLogs");
    const result = args.userId
      ? args.status
        ? await logs
            .withIndex("by_clubId_and_userId_and_status_and_submittedAt", (q) =>
              q
                .eq("clubId", args.clubId)
                .eq("userId", args.userId!)
                .eq("status", args.status!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await logs
            .withIndex("by_clubId_and_userId_and_submittedAt", (q) =>
              q.eq("clubId", args.clubId).eq("userId", args.userId!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
      : args.status
        ? await logs
            .withIndex("by_clubId_and_status_and_submittedAt", (q) =>
              q.eq("clubId", args.clubId).eq("status", args.status!),
            )
            .order("desc")
            .paginate(args.paginationOpts)
        : await logs
            .withIndex("by_clubId_and_submittedAt", (q) =>
              q.eq("clubId", args.clubId),
            )
            .order("desc")
            .paginate(args.paginationOpts);
    return {
      ...result,
      page: await Promise.all(result.page.map((log) => serializeLog(ctx, log))),
    };
  },
});

/** Idempotent, resumable upgrade of existing records; ordinary writes index atomically. */
export const prepareAnalytics = mutation({
  args: { clubId: v.id("clubs") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const context = await requireReviewer(ctx, args.clubId);
    if (
      context.club.volunteerAnalyticsReady ||
      (context.club.volunteerAnalyticsBackfillAt &&
        context.club.volunteerAnalyticsBackfillAt > Date.now() - 60_000)
    )
      return null;
    await ctx.db.patch(args.clubId, {
      volunteerAnalyticsBackfillAt: Date.now(),
    });
    await ctx.scheduler.runAfter(
      0,
      internal.clubs.volunteering.backfillAnalytics,
      { clubId: args.clubId, cursor: null },
    );
    return null;
  },
});

export const backfillAnalytics = internalMutation({
  args: { clubId: v.id("clubs"), cursor: v.union(v.string(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const club = await ctx.db.get(args.clubId);
    if (!club?.isActive || club.volunteerAnalyticsReady) return null;
    const page = await ctx.db
      .query("clubVolunteerLogs")
      .withIndex("by_clubId_and_submittedAt", (q) =>
        q.eq("clubId", args.clubId),
      )
      .paginate({ cursor: args.cursor, numItems: 50 });
    for (const log of page.page) {
      await volunteerLogs.insertIfDoesNotExist(ctx, log);
      const member = await ctx.db
        .query("clubVolunteerTotals")
        .withIndex("by_clubId_and_userId", (q) =>
          q.eq("clubId", args.clubId).eq("userId", log.userId),
        )
        .unique();
      if (member) await volunteerMembers.insertIfDoesNotExist(ctx, member);
    }
    await ctx.db.patch(args.clubId, {
      volunteerAnalyticsReady: page.isDone,
      volunteerAnalyticsBackfillAt: Date.now(),
    });
    if (!page.isDone)
      await ctx.scheduler.runAfter(
        0,
        internal.clubs.volunteering.backfillAnalytics,
        { clubId: args.clubId, cursor: page.continueCursor },
      );
    return null;
  },
});
