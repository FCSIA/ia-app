import type { NotificationCategory } from '~/apps/convex/src/validators';

type ProfileNotificationCategory = Extract<
  NotificationCategory,
  | 'SCHOOL_ANNOUNCEMENT'
  | 'CLUB_JOIN_REQUEST'
  | 'EVENT'
  | 'FLEX_FRIDAY'
  | 'CONTENT_MODERATED'
>;

const PROFILE_NOTIFICATION_LABELS = {
  SCHOOL_ANNOUNCEMENT: 'School Announcements',
  CLUB_JOIN_REQUEST: 'Club Join Requests',
  EVENT: 'Events',
  FLEX_FRIDAY: 'Flex Friday',
  CONTENT_MODERATED: 'Content Moderation Alerts',
} as const satisfies Record<ProfileNotificationCategory, string>;

export const PROFILE_NOTIFICATION_CATEGORIES = Object.entries(PROFILE_NOTIFICATION_LABELS).map(
  ([key, label]) => ({ key: key as ProfileNotificationCategory, label }),
);
