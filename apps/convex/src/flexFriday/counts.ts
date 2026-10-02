import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

/**
 * Maintenance for the denormalized `sessionCount` on a Flex Friday.
 *
 * The Flex Friday tab lists the fifty most recent Fridays and shows how many
 * sessions each one has. Counting those honestly meant reading every session
 * row of every Friday on the page on every load. Convex has no count operator,
 * so the count lives on the Friday document and this helper is the only thing
 * that moves it.
 */

export async function countFlexSessions(ctx: QueryCtx, flexFridayId: Id<"flexFridays">) {
  const rows = await ctx.db
    .query("flexSessions")
    .withIndex("by_flexFridayId", (q) => q.eq("flexFridayId", flexFridayId))
    .collect();
  return rows.length;
}

/**
 * Move a Flex Friday's session counter by `delta`.
 *
 * Call this before inserting or deleting the session itself: a Friday written
 * before the counter existed has to be counted the slow way once, and that
 * count has to describe the state the delta is applied to. Mutations are
 * transactional, so a later failure rolls the counter back with everything
 * else.
 */
export async function adjustFlexSessionCount(
  ctx: MutationCtx,
  flexFridayId: Id<"flexFridays">,
  delta: number,
) {
  if (delta === 0) return;
  const friday = await ctx.db.get(flexFridayId);
  if (!friday) return;

  const current = friday.sessionCount ?? (await countFlexSessions(ctx, flexFridayId));
  await ctx.db.patch(flexFridayId, { sessionCount: Math.max(0, current + delta) });
}
