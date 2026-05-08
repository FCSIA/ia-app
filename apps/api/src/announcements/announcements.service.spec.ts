import { AnnouncementsService } from './announcements.service';
import { AnnouncementTarget, NotificationCategory, Role } from '@prisma/client';

describe('AnnouncementsService profanity masking', () => {
  it('masks profanity in announcement create and notifies author', async () => {
    const prisma: any = {
      announcement: {
        create: jest.fn().mockResolvedValue({
          id: 'ann-1',
          title: '**** update',
          body: 'all good',
          clubId: null,
          isAdminGeneral: false,
        }),
      },
      user: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const audit: any = { log: jest.fn() };
    const moderation: any = {
      maskProfanity: jest
        .fn()
        .mockResolvedValueOnce({
          original: 'crap update',
          masked: '**** update',
          wasFiltered: true,
          matchedWords: ['crap'],
        })
        .mockResolvedValueOnce({
          original: 'all good',
          masked: 'all good',
          wasFiltered: false,
          matchedWords: [],
        }),
      scanContent: jest.fn().mockResolvedValue([]),
      createAutomatedReport: jest.fn().mockResolvedValue({ id: 'report-1' }),
    };
    const notifications: any = {
      deliver: jest.fn().mockResolvedValue({ delivered: 0 }),
    };
    const accessPolicy: any = {};

    const service = new AnnouncementsService(
      prisma,
      audit,
      moderation,
      notifications,
      accessPolicy,
    );
    (service as any).canPost = jest.fn().mockResolvedValue(true);

    await service.create(
      {
        title: 'crap update',
        body: 'all good',
        targetType: AnnouncementTarget.SCHOOL_WIDE,
      } as any,
      'user-1',
      Role.ADMIN,
    );

    expect(prisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: '**** update',
          body: 'all good',
        }),
      }),
    );
    expect(notifications.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['user-1'],
        category: NotificationCategory.CONTENT_MODERATED,
      }),
    );
  });
});
