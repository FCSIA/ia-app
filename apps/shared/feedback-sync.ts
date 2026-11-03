/** GitHub issue sync rules for general feedback, shared by backend and web. */

// A sync still PENDING after this is taken to have died without recording an
// outcome. Twice Convex's 10-minute action limit, so a retry is unlikely to
// overlap a sync that is only slow to start or finish.
export const GITHUB_SYNC_STALE_MS = 20 * 60 * 1000;

export type FeedbackSyncState = {
  githubIssueNumber?: number;
  githubIssueSyncState?: "PENDING" | "SYNCED" | "FAILED";
  githubIssueSyncQueuedAt?: number;
};

export function canRetryGithubSync(report: FeedbackSyncState, now: number): boolean {
  if (report.githubIssueNumber !== undefined) return false;
  if (report.githubIssueSyncState !== "PENDING") return true;
  return (
    report.githubIssueSyncQueuedAt === undefined ||
    now - report.githubIssueSyncQueuedAt >= GITHUB_SYNC_STALE_MS
  );
}
