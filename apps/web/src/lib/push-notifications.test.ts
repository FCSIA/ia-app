import { describe, expect, test } from 'vitest';
import {
  shouldDismissAcknowledgedNotification,
  shouldDismissReadChannelNotification,
} from './notification-dismissal';

describe('shouldDismissAcknowledgedNotification', () => {
  test('dismisses only durable deliveries covered by the acknowledgement cutoff', () => {
    expect(
      shouldDismissAcknowledgedNotification(
        { deliveryId: 'delivery-1', deliveryCreatedAt: 1_000 },
        1_000,
      ),
    ).toBe(true);
    expect(
      shouldDismissAcknowledgedNotification(
        { deliveryId: 'delivery-2', deliveryCreatedAt: 1_001 },
        1_000,
      ),
    ).toBe(false);
  });

  test('does not dismiss a delivery absent from the acknowledged snapshot', () => {
    expect(
      shouldDismissAcknowledgedNotification(
        { deliveryId: 'later-batch', deliveryCreatedAt: 1_000 },
        1_000,
        new Set(['first-batch']),
      ),
    ).toBe(false);
  });

  test('leaves legacy and test notifications alone', () => {
    expect(shouldDismissAcknowledgedNotification(undefined, 1_000)).toBe(false);
    expect(
      shouldDismissAcknowledgedNotification({ deliveryCreatedAt: 1_000 }, 1_000),
    ).toBe(false);
    expect(
      shouldDismissAcknowledgedNotification({ deliveryId: 'test' }, 1_000),
    ).toBe(false);
  });

  test('clears only channel notifications through the receipt boundary', () => {
    const data = {
      deliveryId: 'delivery-1',
      channelId: 'channel-a',
      sourceCreatedAt: 1_000,
    };
    expect(shouldDismissReadChannelNotification(data, 'channel-a', 1_000)).toBe(true);
    expect(shouldDismissReadChannelNotification(data, 'channel-b', 1_000)).toBe(false);
    expect(shouldDismissReadChannelNotification(data, 'channel-a', 999)).toBe(false);
    expect(shouldDismissReadChannelNotification({ channelId: 'channel-a' }, 'channel-a', 1_000)).toBe(false);
  });
});
