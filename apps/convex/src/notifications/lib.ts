import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import {
  notificationCategoryValidator,
  notificationPreferenceLevelValidator,
} from "../validators";

export const notificationValidator = v.object({
  id: v.id("notificationDeliveries"),
  category: notificationCategoryValidator,
  title: v.string(),
  body: v.string(),
  isRead: v.boolean(),
  announcementId: v.union(v.string(), v.null()),
  eventId: v.union(v.string(), v.null()),
  clubId: v.union(v.string(), v.null()),
  channelId: v.union(v.string(), v.null()),
  messageId: v.union(v.string(), v.null()),
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
    isRead: row.isRead,
    announcementId: row.announcementId ?? null,
    eventId: row.eventId ?? null,
    clubId: row.clubId ?? null,
    channelId: row.channelId ?? null,
    messageId: row.messageId ?? null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
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
  };
}
