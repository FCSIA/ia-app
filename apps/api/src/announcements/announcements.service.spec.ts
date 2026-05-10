import { AnnouncementsService } from './announcements.service';
import {
  AnnouncementStatus,
  AnnouncementTarget,
  NotificationCategory,
  Role,
} from '@prisma/client';

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

describe('AnnouncementsService approval and bookmarks', () => {
  function makeService(overrides: Record<string, any> = {}) {
    const prisma: any = {
      announcement: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      announcementBookmark: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
      },
      clubMember: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn() },
      ...overrides,
    };
    const audit: any = { log: jest.fn() };
    const moderation: any = {};
    const notifications: any = { deliver: jest.fn().mockResolvedValue({ delivered: 0 }) };
    const accessPolicy: any = {
      getClubContext: jest.fn().mockResolvedValue({ isSponsor: true, isAdmin: false }),
    };

    const service = new AnnouncementsService(
      prisma,
      audit,
      moderation,
      notifications,
      accessPolicy,
    );

    return { service, prisma, audit, notifications, accessPolicy };
  }

  it('publishes a pending club announcement when a sponsor approves it', async () => {
    const announcement: any = {
      id: 'ann-1',
      authorId: 'leader-1',
      submittedById: 'leader-1',
      clubId: 'club-1',
      title: 'Practice update',
      body: 'Room 101',
      isAdminGeneral: false,
      targetType: AnnouncementTarget.CLUB,
      targetGrade: null,
      targetPathway: null,
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
    };
    const { service, prisma, notifications } = makeService({
      announcement: {
        findUnique: jest.fn().mockResolvedValue(announcement),
        update: jest.fn().mockResolvedValue({
          ...announcement,
          status: AnnouncementStatus.ACTIVE,
        }),
      },
      clubMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'member-1' }]) },
    });

    await service.approve('ann-1', 'sponsor-1', Role.SPONSOR);

    expect(prisma.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ann-1' },
        data: expect.objectContaining({
          status: AnnouncementStatus.ACTIVE,
          approvedById: 'sponsor-1',
        }),
      }),
    );
    expect(notifications.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['member-1'],
        category: NotificationCategory.CLUB_ANNOUNCEMENT,
      }),
    );
  });

  it('stores a user bookmark after confirming announcement access', async () => {
    const announcement: any = {
      id: 'ann-1',
      clubId: null,
      targetType: AnnouncementTarget.SCHOOL_WIDE,
      targetGrade: null,
      targetPathway: null,
      targetGrades: [],
      targetMajorPathways: [],
      targetMinorPathways: [],
    };
    const { service, prisma } = makeService({
      announcement: {
        findUnique: jest.fn().mockResolvedValue(announcement),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'student-1',
          gradeLevel: 10,
          major: null,
          minor: null,
        }),
        findMany: jest.fn(),
      },
    });

    await service.bookmark('ann-1', 'student-1', Role.STUDENT);

    expect(prisma.announcementBookmark.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { announcementId_userId: { announcementId: 'ann-1', userId: 'student-1' } },
      }),
    );
  });

  it('allows admins to create active club announcements without sponsor approval', async () => {
    const announcement: any = {
      id: 'ann-1',
      title: 'Room change',
      body: 'Meet in 203',
      clubId: 'club-1',
      isAdminGeneral: false,
    };
    const { service, prisma, notifications, accessPolicy } = makeService({
      announcement: {
        create: jest.fn().mockResolvedValue(announcement),
      },
      clubMember: { findMany: jest.fn().mockResolvedValue([{ userId: 'member-1' }]) },
    });
    (service as any).canPost = jest.fn().mockResolvedValue(true);
    (service as any).moderation = {
      maskProfanity: jest.fn().mockResolvedValue({
        original: 'ok',
        masked: 'ok',
        wasFiltered: false,
        matchedWords: [],
      }),
      scanContent: jest.fn().mockResolvedValue([]),
    };
    accessPolicy.getClubContext.mockResolvedValue({ isSponsor: false, isAdmin: true });

    await service.create(
      {
        title: 'Room change',
        body: 'Meet in 203',
        targetType: AnnouncementTarget.CLUB,
        clubId: 'club-1',
      } as any,
      'admin-1',
      Role.ADMIN,
    );

    expect(prisma.announcement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: AnnouncementStatus.ACTIVE,
          approvedById: 'admin-1',
          submittedById: undefined,
        }),
      }),
    );
    expect(notifications.deliver).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['member-1'],
        category: NotificationCategory.CLUB_ANNOUNCEMENT,
      }),
    );
  });

  it('only lets authors or admins archive announcements', async () => {
    const { service, prisma } = makeService({
      announcement: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'ann-1',
          authorId: 'author-1',
        }),
        update: jest.fn().mockResolvedValue({ id: 'ann-1' }),
      },
    });

    await expect(service.archive('ann-1', 'teacher-1', Role.TEACHER)).rejects.toThrow(
      'Cannot archive this announcement',
    );

    await service.archive('ann-1', 'admin-1', Role.ADMIN);
    expect(prisma.announcement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ann-1' },
        data: { status: AnnouncementStatus.ARCHIVED },
      }),
    );
  });
});
