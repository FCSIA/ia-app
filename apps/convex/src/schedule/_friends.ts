import { isStudent } from "../../../shared/roles";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { serializeUser } from "./_lib";

const MAX_ACCEPTED_FRIENDSHIPS = 100;

export async function acceptedFriendIds(
  ctx: QueryCtx | MutationCtx,
  userId: Id<"users">,
  limit = MAX_ACCEPTED_FRIENDSHIPS,
) {
  const [outgoing, incoming] = await Promise.all([
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_requesterId_and_status_and_acceptedAt", (q) =>
        q.eq("requesterId", userId).eq("status", "ACCEPTED"),
      )
      .take(limit),
    ctx.db
      .query("studentScheduleFriends")
      .withIndex("by_addresseeId_and_status_and_acceptedAt", (q) =>
        q.eq("addresseeId", userId).eq("status", "ACCEPTED"),
      )
      .take(limit),
  ]);
  return Array.from(
    new Set([
      ...outgoing.map((friendship) => friendship.addresseeId),
      ...incoming.map((friendship) => friendship.requesterId),
    ]),
  );
}

export async function listEligibleFriendsOf(
  ctx: QueryCtx | MutationCtx,
  user: Pick<Doc<"users">, "_id">,
) {
  const friendIds = await acceptedFriendIds(ctx, user._id);
  const candidates = await Promise.all(friendIds.map((friendId) => ctx.db.get(friendId)));
  return candidates
    .flatMap((friend) => (friend?.isActive && isStudent(friend) ? [serializeUser(friend)] : []))
    .sort(
      (left, right) =>
        left.lastName.localeCompare(right.lastName) ||
        left.firstName.localeCompare(right.firstName),
    );
}
