/** General-feedback review states, shared by backend and clients. */

export type FeedbackStatus = "PENDING" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";

/** Staff queue names: new, claimed, and the two decisions. */
export const STAFF_FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  PENDING: "New",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  DISMISSED: "Archived",
};

/** What a submitter reads in their own feedback history. */
export const SUBMITTER_FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  PENDING: "Awaiting review",
  IN_REVIEW: "In review",
  RESOLVED: "Resolved",
  DISMISSED: "Closed",
};

/** Open statuses map to an open GitHub issue; decisions close it. */
export function isOpenFeedbackStatus(status: FeedbackStatus) {
  return status === "PENDING" || status === "IN_REVIEW";
}
