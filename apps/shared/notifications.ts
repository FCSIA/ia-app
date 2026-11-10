/** Notification categories, preference scopes and the push payload both clients read. */

export const NOTIFICATION_CATEGORIES = [
  "SCHOOL_ANNOUNCEMENT",
  "CLUB_ANNOUNCEMENT",
  "CLUB_JOIN_REQUEST",
  "CLUB_CHANNEL_MESSAGE",
  "CLUB_CHANNEL_MENTION",
  "CLUB_CHANNEL_TAG_MENTION",
  "CLUB_CHANNEL_THREAD",
  "EVENT",
  "FLEX_FRIDAY",
  "CONTENT_MODERATED",
  "FEEDBACK",
  "FRIEND_REQUEST",
  "FRIEND_SCHEDULE_CHANGE",
] as const;

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export type NotificationCategoryDetails = {
  badgeLabel: string;
  /** What a person without a stored preference gets, in the app and from the server. */
  defaultEnabled: boolean;
  description: string;
  label: string;
  staffOnly?: boolean;
};

export const NOTIFICATION_CATEGORY_DETAILS = {
  SCHOOL_ANNOUNCEMENT: {
    badgeLabel: 'School',
    defaultEnabled: true,
    description: 'Campus-wide updates, deadlines, and school notices.',
    label: 'School Announcements',
  },
  CLUB_ANNOUNCEMENT: {
    badgeLabel: 'Club',
    defaultEnabled: true,
    description: 'Announcements from clubs you belong to or sponsor.',
    label: 'Club Announcements',
  },
  CLUB_JOIN_REQUEST: {
    badgeLabel: 'Join request',
    defaultEnabled: true,
    description: 'Requests to join clubs you sponsor or manage.',
    label: 'Club Join Requests',
  },
  CLUB_CHANNEL_MESSAGE: {
    badgeLabel: 'Channel',
    defaultEnabled: false,
    description: 'All-message alerts for club channels when you choose to follow every post.',
    label: 'Club Channel Messages',
  },
  CLUB_CHANNEL_MENTION: {
    badgeLabel: 'Mention',
    defaultEnabled: true,
    description: 'Direct club channel mentions of your account.',
    label: 'Club Channel Mentions',
  },
  CLUB_CHANNEL_TAG_MENTION: {
    badgeLabel: 'Tag mention',
    defaultEnabled: true,
    description: 'Club channel tag mentions such as @all, @leaders, or custom tags.',
    label: 'Club Tag Mentions',
  },
  CLUB_CHANNEL_THREAD: {
    badgeLabel: 'Reply',
    defaultEnabled: true,
    description: 'Replies to your club channel messages, and in threads you are part of.',
    label: 'Club Replies',
  },
  EVENT: {
    badgeLabel: 'Event',
    defaultEnabled: true,
    description: 'Event approvals, reminders, and schedule changes.',
    label: 'Events',
  },
  FLEX_FRIDAY: {
    badgeLabel: 'Flex Friday',
    defaultEnabled: true,
    description: 'Workshop registration, assignment, and pass updates.',
    label: 'Flex Friday',
  },
  CONTENT_MODERATED: {
    badgeLabel: 'Moderation',
    defaultEnabled: true,
    description: 'Safety and moderation notices for staff workflows.',
    label: 'Content Moderation Alerts',
    staffOnly: true,
  },
  FEEDBACK: {
    badgeLabel: 'Feedback',
    defaultEnabled: true,
    description: 'Feedback submissions, staff responses, and resolution updates.',
    label: 'Feedback',
  },
  FRIEND_REQUEST: {
    badgeLabel: 'Friends',
    defaultEnabled: true,
    description: 'Schedule friend requests and related friend updates.',
    label: 'Friend Requests',
  },
  FRIEND_SCHEDULE_CHANGE: {
    badgeLabel: 'Schedule',
    defaultEnabled: true,
    description: 'Updates when a friend changes a schedule they share with you.',
    label: 'Friend Schedule Changes',
  },
} as const satisfies Record<NotificationCategory, NotificationCategoryDetails>;

export const GLOBAL_SCOPE_KEY = "global";

export const clubScopeKey = (clubId: string) => `club:${clubId}`;
export const channelScopeKey = (channelId: string) => `${CHANNEL_SCOPE_PREFIX}${channelId}`;
export const announcementScopeKey = (announcementId: string) => `announcement:${announcementId}`;
export const eventScopeKey = (eventId: string) => `event:${eventId}`;

const CHANNEL_SCOPE_PREFIX = "channel:";
/** The channel a channel scope key belongs to, or null for any other key. */
export function parseChannelScopeKey(key: string): string | null {
  return key.startsWith(CHANNEL_SCOPE_PREFIX) ? key.slice(CHANNEL_SCOPE_PREFIX.length) : null;
}

const CHANNEL_MUTE_SCOPE_PREFIX = "mute:channel:";
export const channelMuteScopeKey = (channelId: string) => `${CHANNEL_MUTE_SCOPE_PREFIX}${channelId}`;

/** The channel a mute scope key belongs to, or null for any other key. */
export function parseChannelMuteScopeKey(key: string | null | undefined): string | null {
  return key?.startsWith(CHANNEL_MUTE_SCOPE_PREFIX) ? key.slice(CHANNEL_MUTE_SCOPE_PREFIX.length) : null;
}

/** The most specific preference scope for the ids given. */
export function preferenceScopeKey(ids: {
  clubId?: string | null;
  channelId?: string | null;
  announcementId?: string | null;
  eventId?: string | null;
}): string {
  if (ids.channelId) return channelScopeKey(ids.channelId);
  if (ids.announcementId) return announcementScopeKey(ids.announcementId);
  if (ids.eventId) return eventScopeKey(ids.eventId);
  if (ids.clubId) return clubScopeKey(ids.clubId);
  return GLOBAL_SCOPE_KEY;
}

/** The delivery fields the server puts in every push. */
export type PushDeliveryFields = {
  deliveryId: string;
  deliveryCreatedAt: number;
  channelId?: string | null;
  sourceCreatedAt?: number | null;
};

/** What a client can trust when it reads those fields back from the tray. */
export type PushDeliveryData = {
  deliveryId?: unknown;
  deliveryCreatedAt?: unknown;
  channelId?: unknown;
  sourceCreatedAt?: unknown;
};

/**
 * Pushes from an older worker or test sends lack a delivery id, so they are
 * never treated as covered by inbox acknowledgement.
 */
export function isCoveredByAcknowledgedDelivery(
  data: PushDeliveryData | null | undefined,
  cutoff: number,
  acknowledgedDeliveryIds?: ReadonlySet<string>,
): boolean {
  return (
    typeof data?.deliveryId === "string" &&
    typeof data.deliveryCreatedAt === "number" &&
    data.deliveryCreatedAt <= cutoff &&
    (!acknowledgedDeliveryIds || acknowledgedDeliveryIds.has(data.deliveryId))
  );
}

/** A channel receipt never covers a legacy, unrelated, or newer alert. */
export function isCoveredByChannelReceipt(
  data: PushDeliveryData | null | undefined,
  channelId: string,
  throughSourceCreatedAt: number,
): boolean {
  return (
    typeof data?.deliveryId === "string" &&
    data.channelId === channelId &&
    typeof data.sourceCreatedAt === "number" &&
    data.sourceCreatedAt <= throughSourceCreatedAt
  );
}
