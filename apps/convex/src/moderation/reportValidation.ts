import { ConvexError } from "convex/values";

export const MAX_MODERATION_REPORT_REASON_CHARACTERS = 1_000;

export function normalizeModerationReportReason(reason: string) {
  const normalized = reason.trim();
  if (!normalized) throw new ConvexError("Reason required");
  if (Array.from(normalized).length > MAX_MODERATION_REPORT_REASON_CHARACTERS) {
    throw new ConvexError("Report reason is too long");
  }
  return normalized;
}
