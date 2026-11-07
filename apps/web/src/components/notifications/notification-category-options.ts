import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_DETAILS,
  type NotificationCategory,
  type NotificationCategoryDetails,
} from '~/apps/shared/notifications';

export const NOTIFICATION_CATEGORY_OPTIONS: (NotificationCategoryDetails & { key: NotificationCategory })[] =
  NOTIFICATION_CATEGORIES.map((key) => ({ key, ...NOTIFICATION_CATEGORY_DETAILS[key] }));
