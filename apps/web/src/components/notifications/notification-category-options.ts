import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_DETAILS,
  type NotificationCategory,
  type NotificationCategoryDetails,
} from '~/apps/shared/notifications';

export type NotificationCategoryOption = NotificationCategoryDetails & {
  key: NotificationCategory;
};

/** Settings-facing categories; always-on security notices are excluded. */
export const NOTIFICATION_CATEGORY_OPTIONS: NotificationCategoryOption[] = NOTIFICATION_CATEGORIES.filter(
  (key) => !NOTIFICATION_CATEGORY_DETAILS[key].alwaysOn,
).map((key) => ({ key, ...NOTIFICATION_CATEGORY_DETAILS[key] }));
