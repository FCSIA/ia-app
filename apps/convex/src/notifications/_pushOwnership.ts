import type { Id } from "../_generated/dataModel";

/** Far more accounts than will ever sign in on one browser or phone. */
export const maxAccountsPerPushTarget = 20;

/**
 * Rows for a push target that belong to accounts other than the one now
 * registering it.
 *
 * A web push endpoint or a native push token identifies one browser or app
 * install, and only the account signed in there should receive on it. Rows
 * are keyed by account, so signing a second account into a shared device used
 * to leave the first account's row enabled, and its announcements, mentions,
 * and messages kept appearing on someone else's screen.
 */
export function rowsHeldByOtherAccounts<T extends { userId: Id<"users">; enabled: boolean }>(
  rows: T[],
  userId: Id<"users">,
): T[] {
  return rows.filter((row) => row.enabled && row.userId !== userId);
}
