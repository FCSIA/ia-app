import { ConvexError, v } from "convex/values";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalMutation, mutation, query } from "../_generated/server";
import type { MutationCtx } from "../_generated/server";
import { getCurrentAppUser, getMaybeCurrentAppUser } from "../../lib/currentUser";
import { getClubContext } from "../clubs/access";
import { pushDevicePlatformValidator, type PushDevicePlatform } from "../validators";
import { nextActivity } from "./_activity";
import { appRoom, heartbeatIntervalMs, isDoNotDisturb, presence } from "./_status";

// Presence is read for at most this many people per club page.
const maxClubPeople = 300;
const doNotDisturbMinutes = [60, 8 * 60] as const;

async function recordActivity(
  ctx: MutationCtx,
  userId: Id<"users">,
  platform: PushDevicePlatform,
  now: number,
) {
  const existing = await ctx.db
    .query("userActivity")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  const next = nextActivity(existing, platform, now);
  if (!next) return;
  await ctx.db.insert("activityMarks", next.mark);
  if (existing) await ctx.db.patch(existing._id, next.lastSeen);
  else await ctx.db.insert("userActivity", { userId, ...next.lastSeen });
}

/**
 * Keep this tab online, and note that its person was active this hour.
 *
 * The note is anonymous (see `activityMarks`); only the school-wide heatmap and
 * active-people counts are built from it.
 */
export const heartbeat = mutation({
  args: { sessionId: v.string(), platform: pushDevicePlatformValidator },
  returns: v.object({ sessionToken: v.string() }),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (args.sessionId.length === 0 || args.sessionId.length > 64) {
      throw new ConvexError("Invalid presence session.");
    }
    const { sessionToken } = await presence.heartbeat(
      ctx,
      appRoom,
      user._id,
      args.sessionId,
      heartbeatIntervalMs,
    );
    await recordActivity(ctx, user._id, args.platform, Date.now());
    return { sessionToken };
  },
});

/**
 * Take a closing tab offline at once instead of after its heartbeat lapses.
 * Called by `sendBeacon` while the page unloads, when auth headers can't be
 * attached; the unguessable session token is the authority.
 */
export const disconnect = mutation({
  args: { sessionToken: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await presence.disconnect(ctx, args.sessionToken);
    return null;
  },
});

export const myStatus = query({
  args: {},
  returns: v.union(
    v.object({ doNotDisturb: v.boolean(), until: v.union(v.number(), v.null()) }),
    v.null(),
  ),
  handler: async (ctx) => {
    const user = await getMaybeCurrentAppUser(ctx);
    if (!user) return null;
    const row = await ctx.db
      .query("userStatuses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    return { doNotDisturb: row !== null, until: row?.dndUntil ?? null };
  },
});

/**
 * Turn Do Not Disturb on for an hour, eight hours, or until turned off.
 * Push stops while it is on; everything still reaches the in-app inbox.
 */
export const setDoNotDisturb = mutation({
  args: { minutes: v.union(v.number(), v.null()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    if (args.minutes !== null && !doNotDisturbMinutes.includes(args.minutes as never)) {
      throw new ConvexError("Choose one hour, eight hours, or until you turn it off.");
    }
    const now = Date.now();
    const dndUntil = args.minutes === null ? null : now + args.minutes * 60_000;
    const existing = await ctx.db
      .query("userStatuses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { dndUntil, updatedAt: now });
    else await ctx.db.insert("userStatuses", { userId: user._id, dndUntil, updatedAt: now });
    if (dndUntil !== null) {
      await ctx.scheduler.runAt(dndUntil, internal.presence.status.endDoNotDisturb, {
        userId: user._id,
        dndUntil,
      });
    }
    return null;
  },
});

export const clearDoNotDisturb = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const user = await getCurrentAppUser(ctx);
    const existing = await ctx.db
      .query("userStatuses")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
    return null;
  },
});

/**
 * Ends a timed Do Not Disturb. A later change (cleared, extended, or made
 * indefinite) leaves a different `dndUntil`, so a stale timer does nothing.
 */
export const endDoNotDisturb = internalMutation({
  args: { userId: v.id("users"), dndUntil: v.number() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("userStatuses")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .unique();
    if (row?.dndUntil === args.dndUntil) await ctx.db.delete(row._id);
    return null;
  },
});

/**
 * Who in this club is online right now, for anyone who can open the club.
 * Offline people are left out; Do Not Disturb shows only while online.
 */
export const clubStatuses = query({
  args: { clubId: v.id("clubs") },
  returns: v.array(
    v.object({
      userId: v.id("users"),
      status: v.union(v.literal("online"), v.literal("doNotDisturb")),
    }),
  ),
  handler: async (ctx, args) => {
    const user = await getCurrentAppUser(ctx);
    await getClubContext(ctx, args.clubId, user);

    const people = new Set<Id<"users">>();
    for (const member of await ctx.db
      .query("clubMembers")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .take(maxClubPeople)) {
      people.add(member.userId);
    }
    for (const sponsor of await ctx.db
      .query("clubSponsors")
      .withIndex("by_clubId", (q) => q.eq("clubId", args.clubId))
      .take(maxClubPeople)) {
      people.add(sponsor.userId);
    }

    const statuses = [];
    for (const userId of people) {
      const rooms = await presence.listUser(ctx, userId, true, 1);
      if (rooms.length === 0) continue;
      statuses.push({
        userId,
        status: (await isDoNotDisturb(ctx, userId)) ? ("doNotDisturb" as const) : ("online" as const),
      });
    }
    return statuses;
  },
});
