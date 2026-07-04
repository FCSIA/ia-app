import type { NotificationCategory } from '~/apps/convex/src/validators';

export const PROFILE_NOTIFICATION_CATEGORIES: Array<{
  key: NotificationCategory;
  label: string;
}> = [
  { key: 'SCHOOL_ANNOUNCEMENT', label: 'School Announcements' },
  { key: 'CLUB_JOIN_REQUEST', label: 'Club Join Requests' },
  { key: 'EVENT', label: 'Events' },
  { key: 'FLEX_FRIDAY', label: 'Flex Friday' },
  { key: 'CONTENT_MODERATED', label: 'Content Moderation Alerts' },
];
