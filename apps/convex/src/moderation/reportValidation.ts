import { ConvexError } from "convex/values";

export const MAX_MODERATION_REPORT_REASON_CHARACTERS = 1_000;
export const MAX_FEEDBACK_RESPONSE_CHARACTERS = 1_000;

export function normalizeModerationReportReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) throw new ConvexError("Reason required");
  if (Array.from(normalized).length > MAX_MODERATION_REPORT_REASON_CHARACTERS) {
    throw new ConvexError("Report reason is too long");
  }
  return normalized;
}

export function normalizeFeedbackResponse(body: string) {
  const normalized = body.trim();
  if (!normalized) throw new ConvexError("Response required");
  if (Array.from(normalized).length > MAX_FEEDBACK_RESPONSE_CHARACTERS) {
    throw new ConvexError("Response is too long");
  }
  return normalized;
}
