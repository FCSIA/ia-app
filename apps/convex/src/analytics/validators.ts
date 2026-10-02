import { v, type Infer } from "convex/values";
import {
  notificationCategoryValidator,
  pushDevicePlatformValidator,
} from "../validators";

/**
 * Daily rollups behind the superadmin Analytics tab.
 *
 * Each row summarizes one kind of activity for one school day (America/New_York),
 * so the dashboard reads a few hundred small rows instead of scanning messages,
 * deliveries, or reports on every view. Rows hold counts only; per-person data is
 * kept only while a rollup is in progress and dropped when it completes.
 */

export const pushHealthDataValidator = v.object({
  devices: v.number(),
  truncated: v.boolean(),
  unclaimedSubscriptions: v.number(),
  platforms: v.array(
    v.object({
      platform: pushDevicePlatformValidator,
      // Permission granted and holding a subscription.
      reachable: v.number(),
      // Had push, now can't receive it, and didn't opt out.
      lost: v.number(),
      // Never turned push on, or turned it off.
      notEnabled: v.number(),
      blocked: v.number(),
      unsupported: v.number(),
    }),
  ),
});

export const notificationCategoryStatsValidator = v.object({
  category: notificationCategoryValidator,
  delivered: v.number(),
  read: v.number(),
  // Read-time buckets for deliveries whose first read was recorded.
  readWithin5m: v.number(),
  readWithin1h: v.number(),
  readWithin1d: v.number(),
  readLater: v.number(),
});

export const notificationsDataValidator = v.object({
  categories: v.array(notificationCategoryStatsValidator),
});

export const chatDataValidator = v.object({
  messages: v.number(),
  threadReplies: v.number(),
  activeAuthors: v.number(),
  clubs: v.array(v.object({ clubId: v.id("clubs"), messages: v.number() })),
  // Distinct authors seen so far; cleared when the rollup completes.
  pendingAuthors: v.optional(v.array(v.id("users"))),
});

export const announcementsDataValidator = v.object({
  announcements: v.array(
    v.object({
      announcementId: v.id("announcements"),
      title: v.string(),
      schoolWide: v.boolean(),
      publishedAt: v.number(),
      readersIn24h: v.number(),
      // Accounts a school-wide announcement could reach; null when targeted.
      audience: v.union(v.number(), v.null()),
    }),
  ),
});

export const moderationDataValidator = v.object({
  opened: v.number(),
  escalated: v.number(),
  resolved: v.number(),
  dismissed: v.number(),
  // Time from report to review, for reports reviewed this day.
  reviewedWithin1d: v.number(),
  reviewedWithin3d: v.number(),
  reviewedWithin7d: v.number(),
  reviewedLater: v.number(),
  // Reports waiting for review when the nightly rollup ran. Null for days
  // filled in afterwards, since the backlog on a past day can't be recovered.
  backlog: v.union(v.number(), v.null()),
});

export const flexDataValidator = v.object({
  flexFridayId: v.id("flexFridays"),
  workshops: v.number(),
  // Capacity of workshops that set one; uncapped workshops are counted apart.
  capacity: v.number(),
  registeredInCapped: v.number(),
  registered: v.number(),
  fullWorkshops: v.number(),
  uncappedWorkshops: v.number(),
});

/**
 * A rollup's payload, tagged with the same `kind` as its row. The row stays a
 * plain object (shared doc validators extend every table), while the tag lets
 * code narrow `data` to the right shape.
 */
export const analyticsDataValidator = v.union(
  v.object({ kind: v.literal("pushHealth"), ...pushHealthDataValidator.fields }),
  v.object({ kind: v.literal("notifications"), ...notificationsDataValidator.fields }),
  v.object({ kind: v.literal("chat"), ...chatDataValidator.fields }),
  v.object({ kind: v.literal("announcements"), ...announcementsDataValidator.fields }),
  v.object({ kind: v.literal("moderation"), ...moderationDataValidator.fields }),
  // Keyed by the Flex Friday's date, refreshed while it is near.
  v.object({ kind: v.literal("flex"), ...flexDataValidator.fields }),
);

export const analyticsKindValidator = v.union(
  v.literal("pushHealth"),
  v.literal("notifications"),
  v.literal("chat"),
  v.literal("announcements"),
  v.literal("moderation"),
  v.literal("flex"),
);

export const analyticsDailyValidator = v.object({
  kind: analyticsKindValidator,
  day: v.string(),
  complete: v.boolean(),
  updatedAt: v.number(),
  data: analyticsDataValidator,
});

export type AnalyticsKind = Infer<typeof analyticsKindValidator>;
export type AnalyticsData = Infer<typeof analyticsDataValidator>;
export type PushHealthData = Infer<typeof pushHealthDataValidator>;
export type NotificationsData = Infer<typeof notificationsDataValidator>;
export type ChatData = Infer<typeof chatDataValidator>;
export type AnnouncementsData = Infer<typeof announcementsDataValidator>;
export type ModerationData = Infer<typeof moderationDataValidator>;
export type FlexData = Infer<typeof flexDataValidator>;
