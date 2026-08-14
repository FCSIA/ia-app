import { ConvexError, v } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { internalMutation, mutation, query } from "../_generated/server";
import { internal } from "../_generated/api";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import {
  WRAPPED_SCHEMA_VERSION,
  WRAPPED_STUDENT_ROLES,
  WrappedSummary,
  etHour,
  extractTopWord,
  longestMessageStreak,
  schoolYearLabel,
  schoolYearRange,
  toEtDayKey,
  wrappedAvailability,
  PATHWAY_META,
} from "./_lib";

const availabilityValidator = v.object({
  open: v.boolean(),
  schoolYear: v.number(),
  schoolYearLabel: v.string(),
  opensAt: v.string(),
  closesAt: v.string(),
  secondsUntilOpen: v.number(),
});

const wrappedSummaryValidator = v.object({
  userId: v.string(),
  schoolYearStart: v.number(),
  schoolYearLabel: v.string(),
  rangeStart: v.string(),
  rangeEnd: v.string(),
  messagesSent: v.number(),
  channelsEngaged: v.number(),
  friends: v.number(),
  clubs: v.number(),
  flexCredits: v.number(),
  flexCreditsRequired: v.number(),
  pathwayFlexCredits: v.number(),
  topChannel: v.union(
    v.object({
      channelId: v.string(),
      channelName: v.string(),
      clubId: v.string(),
      clubName: v.string(),
      messages: v.number(),
    }),
    v.null(),
  ),
  topMentioned: v.union(
    v.object({
      userId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      mentions: v.number(),
    }),
    v.null(),
  ),
  pathway: v.object({
    major: v.union(
      v.literal("INFORMATION_TECHNOLOGY"),
      v.literal("HEALTH_SCIENCE"),
      v.literal("ENGINEERING"),
      v.null(),
    ),
    minor: v.union(
      v.literal("INFORMATION_TECHNOLOGY"),
      v.literal("HEALTH_SCIENCE"),
      v.literal("ENGINEERING"),
      v.null(),
    ),
    lanyardColor: v.union(v.string(), v.null()),
    label: v.union(v.string(), v.null()),
    peers: v.number(),
  }),
  mostUsedWord: v.union(
    v.object({ word: v.string(), count: v.number() }),
    v.null(),
  ),
  peakHour: v.union(
    v.object({ hour: v.number(), messages: v.number() }),
    v.null(),
  ),
  longestStreak: v.number(),
  mostActiveDay: v.union(
    v.object({ date: v.string(), messages: v.number() }),
    v.null(),
  ),
  reactionsReceived: v.number(),
  topEmoji: v.union(
    v.object({ emoji: v.string(), count: v.number() }),
    v.null(),
  ),
  longestMessageChars: v.number(),
});

function isStudentRole(roles: string[]) {
  return roles.some((r) =>
    (WRAPPED_STUDENT_ROLES as readonly string[]).includes(r),
  );
}

function isAdmin(roles: string[]) {
  return roles.includes("ADMIN") || roles.includes("SUPER_ADMIN");
}

const SNAPSHOT_BATCH_SIZE = 10;

function currentSchoolYearStart(now: Date): number {
  return now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
}

async function buildSummaryForUser(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  startYear: number,
): Promise<WrappedSummary> {
  const { start, end } = schoolYearRange(startYear);
  const label = schoolYearLabel(startYear);

  const user = await ctx.db.get(userId);
  if (!user) throw new ConvexError("User not found");

  const userMessages = await ctx.db
    .query("clubChannelMessages")
    .withIndex("by_authorId_and_createdAt", (q) =>
      q.eq("authorId", userId).gte("createdAt", start).lte("createdAt", end),
    )
    .take(5000);

  const messagesSent = userMessages.length;
  const channelsEngaged = new Set(userMessages.map((m) => m.channelId)).size;

  const hourCounts = new Array<number>(24).fill(0);
  const dayCounts = new Map<string, number>();
  let longestMessageChars = 0;
  const channelCounts = new Map<Id<"clubChannels">, number>();

  for (const m of userMessages) {
    hourCounts[etHour(new Date(m.createdAt))] += 1;
    const dk = toEtDayKey(new Date(m.createdAt));
    dayCounts.set(dk, (dayCounts.get(dk) ?? 0) + 1);
    if (m.body.length > longestMessageChars) longestMessageChars = m.body.length;
    channelCounts.set(m.channelId, (channelCounts.get(m.channelId) ?? 0) + 1);
  }

  let peakHour: WrappedSummary["peakHour"] = null;
  if (messagesSent > 0) {
    let bestHour = 0;
    for (let h = 1; h < 24; h++) {
      if (hourCounts[h] > hourCounts[bestHour]) bestHour = h;
    }
    peakHour = { hour: bestHour, messages: hourCounts[bestHour] };
  }

  let mostActiveDay: WrappedSummary["mostActiveDay"] = null;
  for (const [date, n] of dayCounts) {
    if (!mostActiveDay || n > mostActiveDay.messages) {
      mostActiveDay = { date, messages: n };
    }
  }

  const longestStreak = longestMessageStreak(
    userMessages.map((m) => new Date(m.createdAt)),
  );
  const mostUsedWord = extractTopWord(userMessages.map((m) => m.body));

  const friendships = await ctx.db
    .query("studentScheduleFriends")
    .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
      q.eq("requesterId", userId).eq("status", "ACCEPTED"),
    )
    .take(500);
  const friendshipsReverse = await ctx.db
    .query("studentScheduleFriends")
    .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
      q.eq("addresseeId", userId).eq("status", "ACCEPTED"),
    )
    .take(500);
  const friends =
    friendships.filter((f) => (f.acceptedAt ?? 0) >= start && (f.acceptedAt ?? 0) <= end)
      .length +
    friendshipsReverse.filter(
      (f) => (f.acceptedAt ?? 0) >= start && (f.acceptedAt ?? 0) <= end,
    ).length;

  const clubMemberships = await ctx.db
    .query("clubMembers")
    .withIndex("by_userId_and_joinedAt", (q) => q.eq("userId", userId))
    .take(200);
  const clubs = clubMemberships.filter((m) => m.joinedAt <= end).length;

  let flexCredits = 0;
  let pathwayFlexCredits = 0;
  const attendances = await ctx.db
    .query("flexAttendances")
    .withIndex("by_studentId_and_flexFridayId", (q) => q.eq("studentId", userId))
    .take(500);
  for (const row of attendances) {
    if (row.status !== "PRESENT") continue;
    const friday = await ctx.db.get(row.flexFridayId);
    if (!friday || friday.date < start || friday.date > end) continue;
    flexCredits += 1;
    if (user.major) {
      const workshop = await ctx.db.get(row.workshopId);
      if (workshop?.targetMajorPathways.includes(user.major)) {
        pathwayFlexCredits += 1;
      }
    }
  }

  let pathwayPeers = 0;
  if (user.major) {
    const peers = await ctx.db
      .query("users")
      .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
        q.eq("isStudent", true),
      )
      .take(500);
    pathwayPeers = peers.filter(
      (p) => p._id !== userId && p.isActive && p.major === user.major,
    ).length;
  }

  let topChannel: WrappedSummary["topChannel"] = null;
  let topChannelId: Id<"clubChannels"> | null = null;
  let topCount = 0;
  for (const [channelId, count] of channelCounts) {
    if (count > topCount) {
      topCount = count;
      topChannelId = channelId;
    }
  }
  if (topChannelId) {
    const channel = await ctx.db.get(topChannelId);
    if (channel) {
      const club = await ctx.db.get(channel.clubId);
      if (club) {
        topChannel = {
          channelId: topChannelId,
          channelName: channel.name,
          clubId: channel.clubId,
          clubName: club.name,
          messages: topCount,
        };
      }
    }
  }

  const mentionCounts = new Map<Id<"users">, number>();
  for (const message of userMessages) {
    const mentions = await ctx.db
      .query("clubChannelMessageMentions")
      .withIndex("by_messageId_and_userId", (q) => q.eq("messageId", message._id))
      .take(50);
    for (const mention of mentions) {
      if (!mention.userId) continue;
      mentionCounts.set(
        mention.userId,
        (mentionCounts.get(mention.userId) ?? 0) + 1,
      );
    }
  }
  let topMentioned: WrappedSummary["topMentioned"] = null;
  for (const [mentionedId, mentions] of mentionCounts) {
    if (!topMentioned || mentions > topMentioned.mentions) {
      const target = await ctx.db.get(mentionedId);
      if (target) {
        topMentioned = {
          userId: mentionedId,
          firstName: target.firstName,
          lastName: target.lastName,
          mentions,
        };
      }
    }
  }

  const emojiCounts = new Map<string, number>();
  let reactionsReceived = 0;
  for (const message of userMessages) {
    const reactions = await ctx.db
      .query("clubChannelMessageReactions")
      .withIndex("by_messageId_and_createdAt", (q) => q.eq("messageId", message._id))
      .take(100);
    reactionsReceived += reactions.length;
    for (const reaction of reactions) {
      emojiCounts.set(reaction.emoji, (emojiCounts.get(reaction.emoji) ?? 0) + 1);
    }
  }
  let topEmoji: WrappedSummary["topEmoji"] = null;
  for (const [emoji, count] of emojiCounts) {
    if (!topEmoji || count > topEmoji.count) topEmoji = { emoji, count };
  }

  const major = user.major ?? null;
  const minor = user.minor ?? null;
  const pathway: WrappedSummary["pathway"] = {
    major,
    minor,
    lanyardColor: major ? PATHWAY_META[major].lanyard : null,
    label: major ? PATHWAY_META[major].label : null,
    peers: pathwayPeers,
  };

  return {
    userId,
    schoolYearStart: startYear,
    schoolYearLabel: label,
    rangeStart: new Date(start).toISOString(),
    rangeEnd: new Date(end).toISOString(),
    messagesSent,
    channelsEngaged,
    friends,
    clubs,
    flexCredits,
    flexCreditsRequired: 12,
    pathwayFlexCredits,
    topChannel,
    topMentioned,
    pathway,
    mostUsedWord,
    peakHour,
    longestStreak,
    mostActiveDay,
    reactionsReceived,
    topEmoji,
    longestMessageChars,
  };
}

async function storeSnapshot(
  ctx: MutationCtx,
  userId: Id<"users">,
  summary: WrappedSummary,
) {
  const now = Date.now();
  const existing = await ctx.db
    .query("wrappedSnapshots")
    .withIndex("by_userId_and_schoolYearStart", (q) =>
      q.eq("userId", userId).eq("schoolYearStart", summary.schoolYearStart),
    )
    .unique();

  const row = {
    userId,
    schoolYearStart: summary.schoolYearStart,
    schoolYearLabel: summary.schoolYearLabel,
    rangeStart: new Date(summary.rangeStart).getTime(),
    rangeEnd: new Date(summary.rangeEnd).getTime(),
    schemaVersion: WRAPPED_SCHEMA_VERSION,
    summary,
    messagesSent: summary.messagesSent,
    channelsEngaged: summary.channelsEngaged,
    friends: summary.friends,
    clubs: summary.clubs,
    flexCredits: summary.flexCredits,
    pathwayFlexCredits: summary.pathwayFlexCredits,
    reactionsReceived: summary.reactionsReceived,
    longestStreak: summary.longestStreak,
    generatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, row);
  } else {
    await ctx.db.insert("wrappedSnapshots", row);
  }
}

export const availability = query({
  args: {},
  returns: availabilityValidator,
  handler: async () => {
    const now = new Date();
    const a = wrappedAvailability(now);
    return {
      open: a.open,
      schoolYear: a.schoolYear,
      schoolYearLabel: schoolYearLabel(a.schoolYear),
      opensAt: a.opensAt.toISOString(),
      closesAt: a.closesAt.toISOString(),
      secondsUntilOpen: Math.round((a.opensAt.getTime() - now.getTime()) / 1000),
    };
  },
});

export const getMine = query({
  args: { schoolYear: v.optional(v.number()) },
  returns: v.union(wrappedSummaryValidator, v.null()),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const now = new Date();
    const window = wrappedAvailability(now);
    const isAdminUser = isAdmin(user.roles);

    if (!window.open && !isAdminUser) {
      throw new ConvexError({
        message: "Wrapped opens in May.",
        code: "WRAPPED_CLOSED",
        opensAt: window.opensAt.toISOString(),
        closesAt: window.closesAt.toISOString(),
        schoolYear: window.schoolYear,
      });
    }

    const startYear = args.schoolYear ?? window.schoolYear;
    const existing = await ctx.db
      .query("wrappedSnapshots")
      .withIndex("by_userId_and_schoolYearStart", (q) =>
        q.eq("userId", user._id).eq("schoolYearStart", startYear),
      )
      .unique();

    if (existing && existing.schemaVersion === WRAPPED_SCHEMA_VERSION) {
      return existing.summary as WrappedSummary;
    }

    const summary = await buildSummaryForUser(ctx, user._id, startYear);
    return summary;
  },
});

export const snapshotStatus = query({
  args: { schoolYear: v.number() },
  returns: v.object({
    schoolYear: v.number(),
    schemaVersion: v.number(),
    eligibleUsers: v.number(),
    generated: v.number(),
    stale: v.number(),
    missing: v.number(),
    latestGeneratedAt: v.union(v.string(), v.null()),
  }),
  handler: async (ctx, args) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user || !isAdmin(user.roles)) {
      return {
        schoolYear: args.schoolYear,
        schemaVersion: WRAPPED_SCHEMA_VERSION,
        eligibleUsers: 0,
        generated: 0,
        stale: 0,
        missing: 0,
        latestGeneratedAt: null,
      };
    }

    const students = await ctx.db
      .query("users")
      .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
        q.eq("isStudent", true),
      )
      .take(5000);
    const eligibleUsers = students.filter(
      (u) => u.isActive && isStudentRole(u.roles),
    ).length;

    const snapshots = await ctx.db
      .query("wrappedSnapshots")
      .withIndex("by_schoolYearStart", (q) =>
        q.eq("schoolYearStart", args.schoolYear),
      )
      .take(5000);

    const generated = snapshots.filter(
      (s) => s.schemaVersion === WRAPPED_SCHEMA_VERSION,
    ).length;
    const stale = snapshots.filter(
      (s) => s.schemaVersion !== WRAPPED_SCHEMA_VERSION,
    ).length;
    const latestGeneratedAt =
      snapshots.length > 0
        ? new Date(
            Math.max(...snapshots.map((s) => s.generatedAt)),
          ).toISOString()
        : null;

    return {
      schoolYear: args.schoolYear,
      schemaVersion: WRAPPED_SCHEMA_VERSION,
      eligibleUsers,
      generated,
      stale,
      missing: Math.max(eligibleUsers - generated, 0),
      latestGeneratedAt,
    };
  },
});

export const generateSnapshots = mutation({
  args: {
    schoolYear: v.number(),
    refresh: v.optional(v.boolean()),
    userIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.object({
    schoolYear: v.number(),
    schemaVersion: v.number(),
    requested: v.number(),
    generated: v.number(),
    skipped: v.number(),
    queued: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (!isAdmin(user.roles)) {
      throw new ConvexError("Admin access required");
    }

    await ctx.scheduler.runAfter(0, internal.wrapped.snapshots.runSnapshotBatch, {
      schoolYear: args.schoolYear,
      refresh: args.refresh ?? false,
      userIds: args.userIds,
    });

    return {
      schoolYear: args.schoolYear,
      schemaVersion: WRAPPED_SCHEMA_VERSION,
      requested: args.userIds?.length ?? 0,
      generated: 0,
      skipped: 0,
      queued: true,
    };
  },
});

/**
 * Builds a bounded set of snapshots, then schedules the next batch. This is
 * intentionally internal: an admin can start a run, but only the backend
 * advances it, so the record is created for every eligible student instead of
 * stopping at an arbitrary first page.
 */
export const runSnapshotBatch = internalMutation({
  args: {
    schoolYear: v.number(),
    refresh: v.boolean(),
    cursor: v.optional(v.string()),
    offset: v.optional(v.number()),
    userIds: v.optional(v.array(v.id("users"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const selectedIds = args.userIds;
    const offset = args.offset ?? 0;
    let nextCursor: string | null = null;
    let students: Doc<"users">[];

    if (selectedIds) {
      const selected = selectedIds.slice(offset, offset + SNAPSHOT_BATCH_SIZE);
      students = (await Promise.all(selected.map((userId) => ctx.db.get(userId))))
        .filter((user): user is Doc<"users"> => user !== null);
    } else {
      const page = await ctx.db
        .query("users")
        .withIndex("by_isStudent_and_lastName_and_firstName", (q) =>
          q.eq("isStudent", true),
        )
        .paginate({ cursor: args.cursor ?? null, numItems: SNAPSHOT_BATCH_SIZE });
      students = page.page;
      nextCursor = page.isDone ? null : page.continueCursor;
    }

    for (const student of students) {
      if (!student.isActive || !isStudentRole(student.roles)) continue;
      if (!args.refresh) {
        const existing = await ctx.db
          .query("wrappedSnapshots")
          .withIndex("by_userId_and_schoolYearStart", (q) =>
            q.eq("userId", student._id).eq("schoolYearStart", args.schoolYear),
          )
          .unique();
        if (existing?.schemaVersion === WRAPPED_SCHEMA_VERSION) continue;
      }
      await storeSnapshot(
        ctx,
        student._id,
        await buildSummaryForUser(ctx, student._id, args.schoolYear),
      );
    }

    if (selectedIds && offset + SNAPSHOT_BATCH_SIZE < selectedIds.length) {
      await ctx.scheduler.runAfter(0, internal.wrapped.snapshots.runSnapshotBatch, {
        schoolYear: args.schoolYear,
        refresh: args.refresh,
        userIds: selectedIds,
        offset: offset + SNAPSHOT_BATCH_SIZE,
      });
    } else if (nextCursor) {
      await ctx.scheduler.runAfter(0, internal.wrapped.snapshots.runSnapshotBatch, {
        schoolYear: args.schoolYear,
        refresh: args.refresh,
        cursor: nextCursor,
      });
    }
    return null;
  },
});

/** Refreshes every active student's current-school-year snapshot overnight. */
export const refreshCurrentSchoolYear = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.wrapped.snapshots.runSnapshotBatch, {
      schoolYear: currentSchoolYearStart(new Date()),
      refresh: true,
    });
    return null;
  },
});
