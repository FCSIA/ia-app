import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Maintenance for the denormalized `memberCount` and `channelCount` on a club.
 *
 * Club lists render a member and channel count for every club they show, and
 * counting those the honest way meant reading every membership row of every
 * club on the page — an admin opening the clubs tab read the entire membership
 * table. Convex has no count operator, so the counts live on the club document
 * and these helpers are the only things that move them.
 */

export async function countClubMembers(ctx: QueryCtx, clubId: Id<"clubs">) {
  const rows = await ctx.db
    .query("clubMembers")
    .withIndex("by_clubId", (q) => q.eq("clubId", clubId))
    .collect();
  return rows.length;
}

export async function countClubChannels(ctx: QueryCtx, clubId: Id<"clubs">) {
  const rows = await ctx.db
    .query("clubChannels")
    .withIndex("by_clubId_and_visibility", (q) => q.eq("clubId", clubId))
    .collect();
  return rows.length;
}

/**
 * Move a club's counters by the given deltas.
 *
 * Call this before inserting or deleting the rows it counts: a club written
 * before the counters existed has to be counted the slow way once, and that
 * count has to describe the state the delta is applied to. Mutations are
 * transactional, so a later failure rolls the counters back with everything
 * else.
 *
 * Pass one total rather than calling this per row — a loop that creates thirty
 * channels should patch the club once.
 */
export async function adjustClubCounts(
  ctx: MutationCtx,
  clubId: Id<"clubs">,
  delta: { members?: number; channels?: number },
) {
  const memberDelta = delta.members ?? 0;
  const channelDelta = delta.channels ?? 0;
  if (memberDelta === 0 && channelDelta === 0) return;

  const club = await ctx.db.get(clubId);
  if (!club) return;

  const patch: { memberCount?: number; channelCount?: number } = {};
  if (memberDelta !== 0) {
    const current = club.memberCount ?? (await countClubMembers(ctx, clubId));
    patch.memberCount = Math.max(0, current + memberDelta);
  }
  if (channelDelta !== 0) {
    const current = club.channelCount ?? (await countClubChannels(ctx, clubId));
    patch.channelCount = Math.max(0, current + channelDelta);
  }
  await ctx.db.patch(clubId, patch);
}

/**
 * Recompute both counters from the rows themselves.
 *
 * For paths that write membership and channel rows in bulk without tracking how
 * many — seeding — and for the backfill.
 */
export async function recountClub(ctx: MutationCtx, clubId: Id<"clubs">) {
  const [memberCount, channelCount] = await Promise.all([
    countClubMembers(ctx, clubId),
    countClubChannels(ctx, clubId),
  ]);
  await ctx.db.patch(clubId, { memberCount, channelCount });
}
