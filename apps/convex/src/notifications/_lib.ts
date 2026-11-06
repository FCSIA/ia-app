import { preferenceScopeKey } from "../../../shared/notifications";
import { v } from "convex/values";
import { preferenceIsOn } from "./deliveryPreference";
import type { QueryCtx } from "../_generated/server";
import type { Doc, Id } from "../_generated/dataModel";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
  notificationSubjectValidatorWith,
} from "../validators";

/** Clients always receive `clubId`, as null where the stored subject leaves it out. */
export const notificationSubjectValidator = notificationSubjectValidatorWith(
  v.union(v.id("clubs"), v.null()),
);

export const notificationValidator = v.object({
  id: v.id("notificationDeliveries"),
  category: notificationCategoryValidator,
  title: v.string(),
  body: v.string(),
  href: v.string(),
  subject: notificationSubjectValidator,
  isRead: v.boolean(),
  createdAt: v.string(),
});

export const preferenceValidator = v.object({
  id: v.id("notificationPreferences"),
  category: notificationCategoryValidator,
  enabled: v.boolean(),
  level: notificationPreferenceLevelValidator,
  locked: v.boolean(),
  clubId: v.union(v.string(), v.null()),
  channelId: v.union(v.string(), v.null()),
  announcementId: v.union(v.string(), v.null()),
  eventId: v.union(v.string(), v.null()),
  scopeKey: v.string(),
  isMuted: v.boolean(),
  mutedUntil: v.union(v.number(), v.null()),
});

export function scopeKey(opts?: {
  scopeKey?: string;
  clubId?: string | null;
  channelId?: string | null;
  announcementId?: string | null;
  eventId?: string | null;
}) {
  if (opts?.scopeKey?.trim()) return opts.scopeKey.trim();
  return preferenceScopeKey(opts ?? {});
}

// Older feedback deliveries used the moderation category. Read their linked
// report rather than guessing from mutable titles or URLs. Deduplicate report
// reads within the already bounded inbox page; no historical data is rewritten.
export async function toNotifications(ctx: QueryCtx, rows: Doc<"notificationDeliveries">[]) {
  const reportIds = new Set<Id<"moderationReports">>();
  for (const row of rows) {
    if (row.category === "CONTENT_MODERATED" && row.subject.kind === "moderationReport") {
      reportIds.add(row.subject.reportId);
    }
  }
  const reports = await Promise.all([...reportIds].map((id) => ctx.db.get(id)));
  const feedbackIds = new Set(reports.flatMap((report) => report?.contentType === "GENERAL" ? [report._id] : []));
  return rows.map((row) => toNotification(
    row.category === "CONTENT_MODERATED" && row.subject.kind === "moderationReport" && feedbackIds.has(row.subject.reportId)
      ? { ...row, category: "FEEDBACK" }
      : row,
  ));
}

export function toNotification(row: Doc<"notificationDeliveries">) {
  return {
    id: row._id,
    category: row.category,
    title: row.title,
    body: row.body,
    href: row.href,
    subject: normalizeSubject(row.subject),
    isRead: row.isRead,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

function normalizeSubject(row: Doc<"notificationDeliveries">["subject"]) {
  if (row.kind === "announcement") return { ...row, clubId: row.clubId ?? null };
  if (row.kind === "event") return { ...row, clubId: row.clubId ?? null };
  return row;
}

export function toPreference(row: Doc<"notificationPreferences">) {
  return {
    id: row._id,
    category: row.category,
    // Still returned for app builds that read it; derived from `level`.
    enabled: preferenceIsOn(row),
    level: row.level,
    locked: row.locked,
    clubId: row.clubId ?? null,
    channelId: row.channelId ?? null,
    announcementId: row.announcementId ?? null,
    eventId: row.eventId ?? null,
    scopeKey: row.scopeKey,
    isMuted: row.isMuted ?? false,
    mutedUntil: row.mutedUntil ?? null,
  };
}
