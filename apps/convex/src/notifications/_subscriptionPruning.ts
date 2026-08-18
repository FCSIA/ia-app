import type { Doc } from "../_generated/dataModel";

/**
 * How many browsers one account keeps registered for push.
 *
 * Comfortably above a realistic phone + laptop + tablet, and well under the
 * page size delivery reads, so the devices someone actually uses always fit.
 */
export const maxEnabledSubscriptionsPerUser = 10;

type PrunableSubscription = Pick<Doc<"notificationPushSubscriptions">, "_id" | "updatedAt">;

/**
 * The subscriptions to retire once a user has registered too many browsers.
 *
 * Rows are only ever disabled when a push service reports an endpoint
 * permanently gone, so reinstalling the app or clearing site data leaves the
 * old row enabled forever. Delivery then reads a bounded page of them in index
 * order — oldest first — so a user who had churned through enough browsers
 * could have every send addressed to endpoints they abandoned while their
 * current phone sat outside the window, receiving nothing.
 *
 * Keeping the most recently refreshed rows is what makes that impossible:
 * every successful send and every re-registration touches `updatedAt`, so a
 * device in use cannot be the one pruned.
 */
export function subscriptionsToRetire<T extends PrunableSubscription>(
  subscriptions: T[],
  limit = maxEnabledSubscriptionsPerUser,
): T[] {
  if (subscriptions.length <= limit) return [];

  return [...subscriptions]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(limit);
}
