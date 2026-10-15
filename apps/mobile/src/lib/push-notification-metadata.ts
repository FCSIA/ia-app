type NotificationData = Record<string, unknown> | undefined;

export function isInboxNotificationCovered(
  data: NotificationData,
  cutoff: number,
) {
  return (
    typeof data?.deliveryId === "string" &&
    typeof data.deliveryCreatedAt === "number" &&
    data.deliveryCreatedAt <= cutoff
  );
}

export function isChannelNotificationCovered(
  data: NotificationData,
  channelId: string,
  throughCreatedAt: number,
) {
  return (
    typeof data?.deliveryId === "string" &&
    data.channelId === channelId &&
    typeof data.sourceCreatedAt === "number" &&
    data.sourceCreatedAt <= throughCreatedAt
  );
}
