import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationCategory, NotificationPreferenceLevel, Prisma } from '@prisma/client';

@Injectable()
export class NotificationsService {
  constructor(private prisma: PrismaService) {}

  private scopeKey(opts?: {
    scopeKey?: string;
    clubId?: string | null;
    channelId?: string | null;
    announcementId?: string | null;
    eventId?: string | null;
  }) {
    if (opts?.scopeKey?.trim()) return opts.scopeKey.trim();
    if (opts?.channelId) return `channel:${opts.channelId}`;
    if (opts?.announcementId) return `announcement:${opts.announcementId}`;
    if (opts?.eventId) return `event:${opts.eventId}`;
    if (opts?.clubId) return `club:${opts.clubId}`;
    return 'global';
  }

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
    opts?: {
      clubId?: string;
      channelId?: string;
      announcementId?: string;
      eventId?: string;
      scopeKey?: string;
      level?: NotificationPreferenceLevel;
    },
  ) {
    const scopeKey = this.scopeKey(opts);
    const level = opts?.level ?? (enabled ? NotificationPreferenceLevel.PUSH : NotificationPreferenceLevel.OFF);
    const existing = await this.prisma.notificationPreference.findUnique({
      where: { userId_category_scopeKey: { userId, category, scopeKey } },
    });
    if (existing?.locked) return existing;

    return this.prisma.notificationPreference.upsert({
      where: { userId_category_scopeKey: { userId, category, scopeKey } },
      update: { enabled: level !== NotificationPreferenceLevel.OFF && enabled, level },
      create: {
        userId,
        category,
        enabled: level !== NotificationPreferenceLevel.OFF && enabled,
        level,
        clubId: opts?.clubId,
        channelId: opts?.channelId,
        announcementId: opts?.announcementId,
        eventId: opts?.eventId,
        scopeKey,
      },
    });
  }

  async bootstrapPreferences(userId: string) {
    const categories: NotificationCategory[] = [
      NotificationCategory.SCHOOL_ANNOUNCEMENT,
      NotificationCategory.CLUB_JOIN_REQUEST,
      NotificationCategory.EVENT,
      NotificationCategory.FLEX_FRIDAY,
      NotificationCategory.CLUB_CHANNEL_MENTION,
      NotificationCategory.CLUB_CHANNEL_TAG_MENTION,
      NotificationCategory.CLUB_CHANNEL_THREAD,
      NotificationCategory.CONTENT_MODERATED,
    ];
    for (const category of categories) {
      await this.prisma.notificationPreference.upsert({
        where: { userId_category_scopeKey: { userId, category, scopeKey: 'global' } },
        update: {},
        create: { userId, category, enabled: true, scopeKey: 'global' },
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
        const scopeKeys = [
          this.scopeKey({ channelId: opts.channelId }),
          this.scopeKey({ announcementId: opts.announcementId }),
          this.scopeKey({ eventId: opts.eventId }),
          this.scopeKey({ clubId: opts.clubId }),
          'global',
        ];
        const prefs = await this.prisma.notificationPreference.findMany({
          where: {
            userId,
            category: opts.category,
            scopeKey: { in: Array.from(new Set(scopeKeys)) },
          },
        });
        const byScope = new Map(prefs.map((pref) => [pref.scopeKey, pref]));
        const pref = scopeKeys.map((key) => byScope.get(key)).find(Boolean);
        if (opts.category === NotificationCategory.CLUB_CHANNEL_MESSAGE && !pref) continue;
        if (pref && (!pref.enabled || pref.level === NotificationPreferenceLevel.OFF)) continue;
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
