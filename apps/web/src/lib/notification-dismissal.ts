type DeliveryNotificationData = {
  deliveryId?: unknown;
  deliveryCreatedAt?: unknown;
  channelId?: unknown;
  sourceCreatedAt?: unknown;
};

/**
 * Notifications shown by an older worker or test sends deliberately lack a
 * delivery id, so never dismiss them as part of inbox acknowledgement.
 */
export function shouldDismissAcknowledgedNotification(
  data: DeliveryNotificationData | null | undefined,
  cutoff: number,
  acknowledgedDeliveryIds?: ReadonlySet<string>,
) {
  return (
    typeof data?.deliveryId === 'string' &&
    typeof data.deliveryCreatedAt === 'number' &&
    data.deliveryCreatedAt <= cutoff &&
    (!acknowledgedDeliveryIds || acknowledgedDeliveryIds.has(data.deliveryId))
  );
}

/** A channel receipt must never clear a legacy, unrelated, or newer alert. */
export function shouldDismissReadChannelNotification(
  data: DeliveryNotificationData | null | undefined,
  channelId: string,
  throughSourceCreatedAt: number,
) {
  return (
    typeof data?.deliveryId === 'string' &&
    data.channelId === channelId &&
    typeof data.sourceCreatedAt === 'number' &&
    data.sourceCreatedAt <= throughSourceCreatedAt
  );
}
