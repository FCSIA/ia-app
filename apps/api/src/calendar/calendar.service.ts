import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEntries(startDate?: string, endDate?: string, tags?: string[]) {
    const where: any = {};

    if (startDate || endDate) {
      where.startAt = {};
      if (startDate) where.startAt.gte = new Date(startDate);
      if (endDate) where.startAt.lte = new Date(endDate);
    }

    if (tags && tags.length > 0) {
      where.tags = { contains: tags[0] }; // SQLite workaround: basic string search
    }

    return this.prisma.calendarEntry.findMany({
      where,
      orderBy: { startAt: 'asc' },
      include: {
        event: {
          select: {
            id: true,
            status: true,
            type: true,
            club: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  async createManual(
    data: {
      title: string;
      description?: string;
      location?: string;
      startAt: string;
      endAt?: string;
      tags?: string[];
    },
    actorId: string,
  ) {
    return this.prisma.calendarEntry.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        tags: JSON.stringify(data.tags || []),
      },
    });
  }
}
