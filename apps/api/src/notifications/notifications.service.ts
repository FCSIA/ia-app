import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationCategory, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  async getMyNotifications(userId: string, unreadOnly = false) {
    return this.prisma.notificationDelivery.findMany({
      where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  async markRead(userId: string, ids: string[]) {
    await this.prisma.notificationDelivery.updateMany({
      where: { id: { in: ids }, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async markAllRead(userId: string) {
    await this.prisma.notificationDelivery.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { success: true };
  }

  async getPreferences(userId: string) {
    return this.prisma.notificationPreference.findMany({
      where: { userId },
    });
  }

  async upsertPreference(
    userId: string,
    category: NotificationCategory,
    enabled: boolean,
    clubId?: string,
  ) {
    return this.prisma.notificationPreference.upsert({
      where: { userId_category_clubId: { userId, category, clubId: clubId ?? null } },
      update: { enabled },
      create: { userId, category, enabled, clubId },
    });
  }

  async bootstrapPreferences(userId: string) {
    const categories: NotificationCategory[] = [
      NotificationCategory.SCHOOL_ANNOUNCEMENT,
      NotificationCategory.EVENT,
      NotificationCategory.FLEX_FRIDAY,
      NotificationCategory.CLUB_CHANNEL_MENTION,
    ];
    for (const category of categories) {
      await this.prisma.notificationPreference.upsert({
        where: { userId_category_clubId: { userId, category, clubId: null } },
        update: {},
        create: { userId, category, enabled: true },
      });
    }
  }

  async deliver(opts: {
    userIds: string[];
    category: NotificationCategory;
    title: string;
    body: string;
    announcementId?: string;
    eventId?: string;
    forceAll?: boolean;
    clubId?: string;
    channelId?: string;
    messageId?: string;
  }) {
    const deliveries: Prisma.NotificationDeliveryCreateManyInput[] = [];

    for (const userId of opts.userIds) {
      // Check preference unless forceAll (admin-general override)
      if (!opts.forceAll) {
        const pref = await this.prisma.notificationPreference.findFirst({
          where: {
            userId,
            category: opts.category,
            clubId: opts.clubId ?? null,
          },
        });
        // If pref exists and is disabled, skip
        if (pref && !pref.enabled) continue;
      }

      deliveries.push({
        userId,
        category: opts.category,
        title: opts.title,
        body: opts.body,
        announcementId: opts.announcementId,
        eventId: opts.eventId,
        clubId: opts.clubId,
        channelId: opts.channelId,
        messageId: opts.messageId,
      });
    }

    if (deliveries.length > 0) {
      await this.prisma.notificationDelivery.createMany({ data: deliveries });
    }
    return { delivered: deliveries.length };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notificationDelivery.count({
      where: { userId, isRead: false },
    });
    return { count };
  }
}
