import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEntries(startDate?: string, endDate?: string, tags?: string[]) {
    const where: Prisma.CalendarEntryWhereInput = {};

    if (startDate || endDate) {
      where.startAt = {};
      if (startDate) {
        where.startAt.gte = new Date(`${startDate}T00:00:00`);
      }
      if (endDate) {
        where.startAt.lte = new Date(`${endDate}T23:59:59.999`);
      }
    }


    if (tags && tags.length > 0) {
      where.tags = { hasSome: tags };
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
}
