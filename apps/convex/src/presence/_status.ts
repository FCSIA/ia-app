import { Presence } from "@convex-dev/presence";
import { components } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const presence = new Presence(components.presence);

/**
 * Every tab heartbeats into one app-wide room. Club pages ask about their own
 * members with `listUser`, so a page only re-renders when one of its members
 * comes or goes, never on every sign-in across the school.
 */
export const appRoom = "app";
export const heartbeatIntervalMs = 30_000;

/** Do Not Disturb is on exactly while its row exists; expiry deletes it. */
export async function isDoNotDisturb(ctx: QueryCtx | MutationCtx, userId: Id<"users">) {
  const row = await ctx.db
    .query("userStatuses")
    .withIndex("by_userId", (q) => q.eq("userId", userId))
    .unique();
  return row !== null;
}
