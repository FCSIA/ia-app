import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

interface AuditLogInput {
  actorId?: string;
  action: string;
  entityType: string;
  entityId?: string;
  meta?: Prisma.InputJsonValue;
}

type AuditActorScope = 'USER' | 'SYSTEM';

type AuditFilterInput = {
  limit?: number;
  offset?: number;
  query?: string;
  actor?: string;
  entityId?: string;
  action?: string;
  entityType?: string;
  actorScope?: AuditActorScope;
  startDate?: string;
  endDate?: string;
};

type AuditEventWithActor = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  meta: Prisma.JsonValue | null;
  createdAt: Date;
  actorId: string | null;
  actor: {
    id: string;
    firstName: string;
    lastName: string;
    uniqueId: string;
  } | null;
};

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  private readonly actorSelect = {
    id: true,
    firstName: true,
    lastName: true,
    uniqueId: true,
  } satisfies Prisma.UserSelect;

  private normalizeLimit(limit?: number) {
    return Math.min(Math.max(limit ?? 100, 1), 500);
  }

  private normalizeOffset(offset?: number) {
    return Math.max(offset ?? 0, 0);
  }

  private toDateAtBoundary(value: string | undefined, endOfDay = false) {
    if (!value?.trim()) return null;
    const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
    const parsed = new Date(`${value}${suffix}`);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private stringifyValue(value: unknown): string | null {
    if (value == null) return null;
    if (Array.isArray(value)) {
      const joined = value
        .map((entry) => this.stringifyValue(entry))
        .filter((entry): entry is string => !!entry)
        .join(', ');
      return joined || null;
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
  }

  private buildFields(
    fields: Array<{ label: string; value: unknown }>,
  ): Array<{ label: string; value: string }> {
    return fields
      .map((field) => ({
        label: field.label,
        value: this.stringifyValue(field.value),
      }))
      .filter((field): field is { label: string; value: string } => !!field.value);
  }

  private getMetaRecord(value: Prisma.JsonValue | null | undefined) {
    if (!value || Array.isArray(value) || typeof value !== 'object') return null;
    return value as Record<string, unknown>;
  }

  private buildWhere(filters: AuditFilterInput) {
    const and: Prisma.AuditEventWhereInput[] = [];

    if (filters.query?.trim()) {
      const query = filters.query.trim();
      and.push({
        OR: [
          { action: { contains: query, mode: 'insensitive' } },
          { entityType: { contains: query, mode: 'insensitive' } },
          { entityId: { contains: query, mode: 'insensitive' } },
          {
            actor: {
              is: {
                OR: [
                  { firstName: { contains: query, mode: 'insensitive' } },
                  { lastName: { contains: query, mode: 'insensitive' } },
                  { uniqueId: { contains: query, mode: 'insensitive' } },
                ],
              },
            },
          },
        ],
      });
    }

    if (filters.actor?.trim()) {
      const actorQuery = filters.actor.trim();
      and.push({
        actor: {
          is: {
            OR: [
              { firstName: { contains: actorQuery, mode: 'insensitive' } },
              { lastName: { contains: actorQuery, mode: 'insensitive' } },
              { uniqueId: { contains: actorQuery, mode: 'insensitive' } },
            ],
          },
        },
      });
    }

    if (filters.entityId?.trim()) {
      and.push({
        entityId: { contains: filters.entityId.trim(), mode: 'insensitive' },
      });
    }

    if (filters.action?.trim()) {
      and.push({ action: filters.action.trim() });
    }

    if (filters.entityType?.trim()) {
      and.push({ entityType: filters.entityType.trim() });
    }

    if (filters.actorScope === 'SYSTEM') {
      and.push({ actorId: null });
    } else if (filters.actorScope === 'USER') {
      and.push({ actorId: { not: null } });
    }

    const startDate = this.toDateAtBoundary(filters.startDate);
    const endDate = this.toDateAtBoundary(filters.endDate, true);
    if (startDate || endDate) {
      and.push({
        createdAt: {
          ...(startDate ? { gte: startDate } : {}),
          ...(endDate ? { lte: endDate } : {}),
        },
      });
    }

    return and.length > 0 ? ({ AND: and } satisfies Prisma.AuditEventWhereInput) : undefined;
  }

  private async resolveEntityPreview(
    event: AuditEventWithActor,
  ) {
    const meta = this.getMetaRecord(event.meta);

    switch (event.entityType) {
      case 'ClubChannelMessage': {
        if (!event.entityId) {
          return {
            kind: 'ClubChannelMessage',
            title: `${meta?.channelName ?? 'Channel'} message`,
            subtitle: typeof meta?.clubName === 'string' ? meta.clubName : undefined,
            body: typeof meta?.bodyPreview === 'string' ? meta.bodyPreview : null,
            fields: this.buildFields([
              { label: 'Club ID', value: meta?.clubId },
              { label: 'Channel ID', value: meta?.channelId },
              { label: 'Attachments', value: meta?.attachmentCount },
              { label: 'Mentions', value: meta?.mentionCount },
            ]),
          };
        }

        const message = await this.prisma.clubChannelMessage.findUnique({
          where: { id: event.entityId },
          include: {
            author: { select: this.actorSelect },
            attachments: {
              select: { fileName: true, mimeType: true, size: true },
            },
            channel: {
              select: {
                id: true,
                name: true,
                visibility: true,
                club: { select: { id: true, name: true } },
              },
            },
          },
        });

        if (!message) {
          return {
            kind: 'ClubChannelMessage',
            title: `${meta?.channelName ?? 'Channel'} message`,
            subtitle: typeof meta?.clubName === 'string' ? meta.clubName : undefined,
            body: typeof meta?.bodyPreview === 'string' ? meta.bodyPreview : null,
            fields: this.buildFields([
              { label: 'Club ID', value: meta?.clubId },
              { label: 'Channel ID', value: meta?.channelId },
              { label: 'Attachments', value: meta?.attachmentCount },
              { label: 'Mentions', value: meta?.mentionCount },
            ]),
          };
        }

        return {
          kind: 'ClubChannelMessage',
          title: `#${message.channel.name}`,
          subtitle: message.channel.club.name,
          body: message.body,
          href: `/clubs/${message.channel.club.id}/channels/${message.channel.id}`,
          hrefLabel: 'Open channel',
          fields: this.buildFields([
            { label: 'Club', value: message.channel.club.name },
            { label: 'Channel', value: `#${message.channel.name}` },
            { label: 'Visibility', value: message.channel.visibility },
            {
              label: 'Author',
              value: `${message.author.firstName} ${message.author.lastName} (${message.author.uniqueId})`,
            },
            { label: 'Reply', value: message.parentMessageId ? 'Yes' : 'No' },
            { label: 'Attachments', value: message.attachments.length },
          ]),
        };
      }
      case 'ClubChannel': {
        if (!event.entityId) return null;

        const channel = await this.prisma.clubChannel.findUnique({
          where: { id: event.entityId },
          select: {
            id: true,
            name: true,
            description: true,
            visibility: true,
            club: { select: { id: true, name: true } },
          },
        });
        if (!channel) return null;

        return {
          kind: 'ClubChannel',
          title: `#${channel.name}`,
          subtitle: channel.club.name,
          body: channel.description,
          href: `/clubs/${channel.club.id}/channels/${channel.id}`,
          hrefLabel: 'Open channel',
          fields: this.buildFields([
            { label: 'Club', value: channel.club.name },
            { label: 'Visibility', value: channel.visibility },
          ]),
        };
      }
      case 'Announcement': {
        if (!event.entityId) return null;

        const announcement = await this.prisma.announcement.findUnique({
          where: { id: event.entityId },
          select: {
            id: true,
            title: true,
            body: true,
            targetType: true,
            status: true,
            club: { select: { id: true, name: true } },
          },
        });
        if (!announcement) return null;

        return {
          kind: 'Announcement',
          title: announcement.title,
          subtitle: announcement.club?.name ?? 'School-wide',
          body: announcement.body,
          href: `/announcements/${announcement.id}`,
          hrefLabel: 'Open announcement',
          fields: this.buildFields([
            { label: 'Target', value: announcement.targetType },
            { label: 'Status', value: announcement.status },
          ]),
        };
      }
      case 'Comment': {
        if (!event.entityId) return null;

        const comment = await this.prisma.comment.findUnique({
          where: { id: event.entityId },
          select: {
            id: true,
            body: true,
            announcement: { select: { id: true, title: true } },
          },
        });
        if (!comment) return null;

        return {
          kind: 'Comment',
          title: 'Announcement comment',
          subtitle: comment.announcement.title,
          body: comment.body,
          href: `/announcements/${comment.announcement.id}`,
          hrefLabel: 'Open announcement',
        };
      }
      case 'Event': {
        if (!event.entityId) return null;

        const eventRecord = await this.prisma.event.findUnique({
          where: { id: event.entityId },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            location: true,
            startAt: true,
            endAt: true,
            club: { select: { id: true, name: true } },
          },
        });
        if (!eventRecord) return null;

        return {
          kind: 'Event',
          title: eventRecord.title,
          subtitle: eventRecord.club?.name ?? 'General event',
          body: eventRecord.description,
          href: `/events/${eventRecord.id}`,
          hrefLabel: 'Open event',
          fields: this.buildFields([
            { label: 'Status', value: eventRecord.status },
            { label: 'Location', value: eventRecord.location },
            { label: 'Starts', value: eventRecord.startAt.toISOString() },
            { label: 'Ends', value: eventRecord.endAt?.toISOString() },
          ]),
        };
      }
      case 'Club': {
        if (!event.entityId) return null;

        const club = await this.prisma.club.findUnique({
          where: { id: event.entityId },
          select: { id: true, name: true, description: true, joinPolicy: true, isActive: true },
        });
        if (!club) return null;

        return {
          kind: 'Club',
          title: club.name,
          body: club.description,
          href: `/clubs/${club.id}`,
          hrefLabel: 'Open club',
          fields: this.buildFields([
            { label: 'Join policy', value: club.joinPolicy },
            { label: 'Active', value: club.isActive },
          ]),
        };
      }
      default:
        return null;
    }
  }

  async log(input: AuditLogInput) {
    return this.prisma.auditEvent.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        meta: input.meta,
      },
    });
  }

  async getAll(filters: AuditFilterInput = {}) {
    return this.prisma.auditEvent.findMany({
      where: this.buildWhere(filters),
      orderBy: { createdAt: 'desc' },
      take: this.normalizeLimit(filters.limit),
      skip: this.normalizeOffset(filters.offset),
      include: { actor: { select: this.actorSelect } },
    });
  }

  async getOne(id: string) {
    const event = await this.prisma.auditEvent.findUnique({
      where: { id },
      include: { actor: { select: this.actorSelect } },
    });

    if (!event) {
      throw new NotFoundException('Audit event not found');
    }

    const entityPreview = await this.resolveEntityPreview(event);
    return {
      ...event,
      entityPreview,
    };
  }

  async getForEntity(entityType: string, entityId: string) {
    return this.prisma.auditEvent.findMany({
      where: { entityType, entityId },
      orderBy: { createdAt: 'desc' },
      include: { actor: { select: this.actorSelect } },
    });
  }
}
