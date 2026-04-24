import { EventsService } from './events.service';
import { EventStatus, NotificationCategory, Role } from '@prisma/client';

describe('EventsService profanity masking', () => {
  it('masks profanity in event fields and notifies author', async () => {
    const prisma: any = {
      event: {
        create: jest.fn().mockResolvedValue({
          id: 'event-1',
          title: '**** fair',
          description: 'desc',
          status: EventStatus.PUBLISHED,
          startAt: new Date(),
          endAt: null,
          clubId: null,
        }),
      },
      calendarEntry: { findUnique: jest.fn().mockResolvedValue({ id: 'existing' }) },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const audit: any = { log: jest.fn() };
    const moderation: any = {
      maskProfanity: jest
        .fn()
        .mockResolvedValueOnce({
          original: 'crap fair',
          masked: '**** fair',
          wasFiltered: true,
          matchedWords: ['crap'],
        })
        .mockResolvedValueOnce({
          original: 'desc',
          masked: 'desc',
          wasFiltered: false,
          matchedWords: [],
        })
        .mockResolvedValueOnce({
          original: '',
          masked: '',
          wasFiltered: false,
          matchedWords: [],
        }),
      scanContent: jest.fn().mockResolvedValue([]),
    };
    const notifications: any = {
      deliver: jest.fn().mockResolvedValue({ delivered: 0 }),
    };
    const accessPolicy: any = {};
    const service = new EventsService(
      prisma,
      audit,
      moderation,
      notifications,
      accessPolicy,
    );

    await service.create(
      { title: 'crap fair', startAt: new Date().toISOString() },
      'user-1',
      Role.ADMIN,
    );

    expect(prisma.event.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: '**** fair' }),
      }),
    );
    expect(notifications.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        category: NotificationCategory.CONTENT_MODERATED,
        userIds: ['user-1'],
      }),
    );
  });
});
