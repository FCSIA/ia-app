/** General-feedback review states, shared by backend and clients. */

export const FEEDBACK_STATUSES = ["PENDING", "IN_REVIEW", "RESOLVED", "DISMISSED"] as const;
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number];

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

// Staff quick actions once saved these as review notes; they only repeat the
// status, so submitter views skip them.
const LEGACY_PLACEHOLDER_NOTES = new Set(["Reviewed", "Dismissed"]);

/** A review note worth showing a submitter, or undefined. */
export function meaningfulReviewNote(note: string | undefined) {
  const trimmed = note?.trim();
  return trimmed && !LEGACY_PLACEHOLDER_NOTES.has(trimmed) ? trimmed : undefined;
}
