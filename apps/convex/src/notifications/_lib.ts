import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
} from "../validators";

export const notificationSubjectValidator = v.union(
  v.object({
    kind: v.literal("announcement"),
    announcementId: v.id("announcements"),
    clubId: v.union(v.id("clubs"), v.null()),
  }),
  v.object({
    kind: v.literal("event"),
    eventId: v.id("events"),
    clubId: v.union(v.id("clubs"), v.null()),
  }),
  v.object({
    kind: v.literal("club"),
    clubId: v.id("clubs"),
  }),
  v.object({
    kind: v.literal("clubChannel"),
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
  }),
  v.object({
    kind: v.literal("clubMessage"),
    clubId: v.id("clubs"),
    channelId: v.id("clubChannels"),
    messageId: v.id("clubChannelMessages"),
  }),
  v.object({
    kind: v.literal("flexFriday"),
    flexFridayId: v.id("flexFridays"),
  }),
  v.object({
    kind: v.literal("moderationReport"),
    reportId: v.id("moderationReports"),
  }),
  v.object({
    kind: v.literal("friendRequest"),
    friendshipId: v.id("studentScheduleFriends"),
  }),
  v.object({
    kind: v.literal("system"),
  }),
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
  if (opts?.channelId) return `channel:${opts.channelId}`;
  if (opts?.announcementId) return `announcement:${opts.announcementId}`;
  if (opts?.eventId) return `event:${opts.eventId}`;
  if (opts?.clubId) return `club:${opts.clubId}`;
  return "global";
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
    enabled: row.enabled,
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
