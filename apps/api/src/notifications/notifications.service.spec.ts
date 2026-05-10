import {
  NotificationCategory,
  NotificationPreferenceLevel,
} from '@prisma/client';
import { NotificationsService } from './notifications.service';

describe('NotificationsService preferences', () => {
  it('stores preference levels and disables OFF preferences', async () => {
    const prisma: any = {
      notificationPreference: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({ id: 'pref-1' }),
      },
    };
    const service = new NotificationsService(prisma);

    await service.upsertPreference(
      'user-1',
      NotificationCategory.CLUB_CHANNEL_MESSAGE,
      true,
      {
        channelId: 'channel-1',
        level: NotificationPreferenceLevel.TIME_SENSITIVE,
      },
    );

    expect(prisma.notificationPreference.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          enabled: true,
          level: NotificationPreferenceLevel.TIME_SENSITIVE,
        }),
        create: expect.objectContaining({
          scopeKey: 'channel:channel-1',
          enabled: true,
          level: NotificationPreferenceLevel.TIME_SENSITIVE,
        }),
      }),
    );

    await service.upsertPreference(
      'user-1',
      NotificationCategory.CLUB_CHANNEL_MESSAGE,
      false,
      {
        channelId: 'channel-1',
        level: NotificationPreferenceLevel.OFF,
      },
    );

    expect(prisma.notificationPreference.upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          enabled: false,
          level: NotificationPreferenceLevel.OFF,
        }),
      }),
    );
  });

  it('requires explicit opt-in for all-message channel notifications', async () => {
    const prisma: any = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      notificationDelivery: {
        createMany: jest.fn(),
      },
    };
    const service = new NotificationsService(prisma);

    await service.deliver({
      userIds: ['user-1'],
      category: NotificationCategory.CLUB_CHANNEL_MESSAGE,
      title: 'Robotics · #nlc-2026',
      body: 'Update',
      clubId: 'club-1',
      channelId: 'channel-1',
    });

    expect(prisma.notificationDelivery.createMany).not.toHaveBeenCalled();
  });

  it('suppresses notifications when the resolved scoped preference is OFF', async () => {
    const prisma: any = {
      notificationPreference: {
        findMany: jest.fn().mockResolvedValue([
          {
            scopeKey: 'channel:channel-1',
            enabled: false,
            level: NotificationPreferenceLevel.OFF,
          },
        ]),
      },
      notificationDelivery: {
        createMany: jest.fn(),
      },
    };
    const service = new NotificationsService(prisma);

    await service.deliver({
      userIds: ['user-1'],
      category: NotificationCategory.CLUB_CHANNEL_MENTION,
      title: 'Mention',
      body: 'Update',
      clubId: 'club-1',
      channelId: 'channel-1',
    });

    expect(prisma.notificationDelivery.createMany).not.toHaveBeenCalled();
  });
});
