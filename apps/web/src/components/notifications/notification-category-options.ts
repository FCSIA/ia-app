import {
  NOTIFICATION_CATEGORIES,
  NOTIFICATION_CATEGORY_DETAILS,
  type NotificationCategory,
  type NotificationCategoryDetails,
} from '~/apps/shared/notifications';

export type NotificationCategoryOption = NotificationCategoryDetails & {
  key: NotificationCategory;
};

function settingsCategories(): NotificationCategoryOption[] {
  const options: NotificationCategoryOption[] = [];
  for (const key of NOTIFICATION_CATEGORIES) {
    const details: NotificationCategoryDetails = NOTIFICATION_CATEGORY_DETAILS[key];
    if (details.alwaysOn) continue;
    options.push({ key, ...details });
  }
  return options;
}

/** Settings-facing categories; always-on security notices are excluded. */
export const NOTIFICATION_CATEGORY_OPTIONS = settingsCategories();
