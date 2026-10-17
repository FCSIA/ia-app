import type { NotificationCategory } from '~/apps/convex/src/validators';

type NotificationCategoryDetails = {
  badgeLabel: string;
  defaultEnabled: boolean;
  description: string;
  label: string;
  staffOnly?: boolean;
};

export type NotificationCategoryOption = NotificationCategoryDetails & {
  key: NotificationCategory;
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

export const NOTIFICATION_CATEGORY_OPTIONS: NotificationCategoryOption[] = Object.entries(NOTIFICATION_CATEGORY_DETAILS).map(
  ([key, details]) => ({
    key: key as NotificationCategory,
    ...details,
  }),
);
