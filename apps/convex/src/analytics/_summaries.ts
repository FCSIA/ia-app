import type { Doc, Id } from "../_generated/dataModel";
import { deviceLostPush } from "../notifications/_pushDevices";
import type { PushDevicePlatform } from "../validators";
import type {
  ChatData,
  EngagementData,
  FlexData,
  ModerationData,
  NotificationsData,
  PushHealthData,
} from "./validators";

const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;

const platforms: PushDevicePlatform[] = ["ios", "android", "desktop"];

type ReportedDevice = Pick<
  Doc<"notificationPushDevices">,
  "platform" | "standalone" | "permission" | "subscribed" | "optedOut" | "lastSubscribedAt"
>;

/**
 * Sort devices into exclusive push states per platform.
 *
 * "Lost" comes first because it overlaps the others: a device that had push
 * and now reports "ask" or "blocked" is a loss, not a device that never opted in.
 */
export function summarizePushHealth(
  devices: ReportedDevice[],
  subscriptions: Pick<Doc<"notificationPushSubscriptions">, "enabled" | "deviceId">[],
  truncated: boolean,
): PushHealthData {
  const counts = new Map(
    platforms.map((platform) => [
      platform,
      { platform, reachable: 0, lost: 0, notEnabled: 0, blocked: 0, unsupported: 0 },
    ]),
  );
  for (const device of devices) {
    const row = counts.get(device.platform);
    if (!row) continue;
    if (deviceLostPush(device)) row.lost += 1;
    else if (device.permission === "granted" && device.subscribed === true) row.reachable += 1;
    else if (device.permission === "denied") row.blocked += 1;
    else if (device.permission === "unsupported") row.unsupported += 1;
    else row.notEnabled += 1;
  }
  return {
    devices: devices.length,
    truncated,
    unclaimedSubscriptions: subscriptions.filter(
      (row) => row.enabled && row.deviceId === undefined,
    ).length,
    platforms: [...counts.values()],
  };
}

export function addDeliveries(
  data: NotificationsData,
  rows: Pick<Doc<"notificationDeliveries">, "category" | "isRead" | "readAt" | "createdAt">[],
): NotificationsData {
  const byCategory = new Map(data.categories.map((stats) => [stats.category, { ...stats }]));
  for (const row of rows) {
    const stats = byCategory.get(row.category) ?? {
      category: row.category,
      delivered: 0,
      read: 0,
      readWithin5m: 0,
      readWithin1h: 0,
      readWithin1d: 0,
      readLater: 0,
    };
    stats.delivered += 1;
    if (row.isRead) stats.read += 1;
    if (row.readAt !== undefined) {
      const elapsed = row.readAt - row.createdAt;
      if (elapsed <= 5 * minute) stats.readWithin5m += 1;
      else if (elapsed <= hour) stats.readWithin1h += 1;
      else if (elapsed <= day) stats.readWithin1d += 1;
      else stats.readLater += 1;
    }
    byCategory.set(row.category, stats);
  }
  return {
    categories: [...byCategory.values()].sort((a, b) => a.category.localeCompare(b.category)),
  };
}

export const emptyChat: ChatData = {
  messages: 0,
  threadReplies: 0,
  activeAuthors: 0,
  clubs: [],
  pendingAuthors: [],
};

type ChatMessage = Pick<Doc<"clubChannelMessages">, "authorId" | "parentMessageId" | "deletedAt"> & {
  clubId: Id<"clubs"> | null;
};

export function addMessages(data: ChatData, rows: ChatMessage[]): ChatData {
  const clubs = new Map(data.clubs.map((club) => [club.clubId, club.messages]));
  const authors = new Set(data.pendingAuthors ?? []);
  let messages = data.messages;
  let threadReplies = data.threadReplies;
  for (const row of rows) {
    if (row.deletedAt !== undefined) continue;
    messages += 1;
    if (row.parentMessageId !== undefined) threadReplies += 1;
    authors.add(row.authorId);
    if (row.clubId) clubs.set(row.clubId, (clubs.get(row.clubId) ?? 0) + 1);
  }
  return {
    messages,
    threadReplies,
    activeAuthors: authors.size,
    clubs: [...clubs].map(([clubId, count]) => ({ clubId, messages: count })),
    pendingAuthors: [...authors],
  };
}

/** Keep the count and drop who wrote, once the day is fully counted. */
export function finishChat(data: ChatData): ChatData {
  return {
    messages: data.messages,
    threadReplies: data.threadReplies,
    activeAuthors: data.pendingAuthors?.length ?? data.activeAuthors,
    clubs: data.clubs,
  };
}

export function summarizeModeration(
  bounds: { start: number; end: number },
  reports: Pick<Doc<"moderationReports">, "createdAt" | "isEscalated" | "status" | "reviewedAt">[],
  backlog: number | null,
): ModerationData {
  const data: ModerationData = {
    opened: 0,
    escalated: 0,
    resolved: 0,
    dismissed: 0,
    reviewedWithin1d: 0,
    reviewedWithin3d: 0,
    reviewedWithin7d: 0,
    reviewedLater: 0,
    backlog,
  };
  const within = (ms: number) => ms >= bounds.start && ms < bounds.end;
  for (const report of reports) {
    if (within(report.createdAt)) {
      data.opened += 1;
      if (report.isEscalated) data.escalated += 1;
    }
    if (report.reviewedAt === undefined || !within(report.reviewedAt)) continue;
    if (report.status === "RESOLVED") data.resolved += 1;
    else if (report.status === "DISMISSED") data.dismissed += 1;
    const elapsed = report.reviewedAt - report.createdAt;
    if (elapsed <= day) data.reviewedWithin1d += 1;
    else if (elapsed <= 3 * day) data.reviewedWithin3d += 1;
    else if (elapsed <= 7 * day) data.reviewedWithin7d += 1;
    else data.reviewedLater += 1;
  }
  return data;
}

export function readersWithin24h(publishedAt: number, reads: Pick<Doc<"announcementReads">, "readAt">[]) {
  return reads.filter((read) => read.readAt >= publishedAt && read.readAt - publishedAt <= day).length;
}

export function summarizeFlex(
  flexFridayId: Id<"flexFridays">,
  workshops: { capacity: number | undefined; registered: number }[],
): FlexData {
  const data: FlexData = {
    flexFridayId,
    workshops: workshops.length,
    capacity: 0,
    registeredInCapped: 0,
    registered: 0,
    fullWorkshops: 0,
    uncappedWorkshops: 0,
  };
  for (const workshop of workshops) {
    data.registered += workshop.registered;
    if (workshop.capacity === undefined || workshop.capacity <= 0) {
      data.uncappedWorkshops += 1;
      continue;
    }
    data.capacity += workshop.capacity;
    data.registeredInCapped += workshop.registered;
    if (workshop.registered >= workshop.capacity) data.fullWorkshops += 1;
  }
  return data;
}

export const emptyEngagement: EngagementData = {
  activePeople: 0,
  newWeekPeople: 0,
  platforms: { ios: 0, android: 0, desktop: 0 },
  hours: Array.from({ length: 24 }, () => 0),
};

export function addMarks(
  data: EngagementData,
  marks: Pick<
    Doc<"activityMarks">,
    "hour" | "platform" | "newHour" | "newDay" | "newWeek" | "newPlatformDay"
  >[],
): EngagementData {
  const next = {
    activePeople: data.activePeople,
    newWeekPeople: data.newWeekPeople,
    platforms: { ...data.platforms },
    hours: [...data.hours],
  };
  for (const mark of marks) {
    if (mark.newDay) next.activePeople += 1;
    if (mark.newWeek) next.newWeekPeople += 1;
    if (mark.newPlatformDay) next.platforms[mark.platform] += 1;
    if (mark.newHour && mark.hour >= 0 && mark.hour < 24) next.hours[mark.hour] += 1;
  }
  return next;
}
