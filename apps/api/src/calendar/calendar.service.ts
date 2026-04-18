import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CalendarSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CalendarService {
  constructor(private prisma: PrismaService) {}

  async getEntries(
    userId: string,
    startDate?: string,
    endDate?: string,
    tags?: string[],
    sources?: CalendarSource[],
  ) {
    const dateFilter: Prisma.CalendarEntryWhereInput['startAt'] = {};
    if (startDate) dateFilter.gte = new Date(`${startDate}T00:00:00`);
    if (endDate) dateFilter.lte = new Date(`${endDate}T23:59:59.999`);

    const tagsFilter =
      tags && tags.length > 0 ? { tags: { hasSome: tags } } : {};

    // Build source filter:
    // - Public sources (DISTRICT, SCHOOL, CLUB) are visible to everyone
    // - PERSONAL entries are only visible to the user who created them
    let sourceConditions: Prisma.CalendarEntryWhereInput[];

    const requestedSources =
      sources && sources.length > 0
        ? sources
        : ([
            CalendarSource.DISTRICT,
            CalendarSource.SCHOOL,
            CalendarSource.CLUB,
            CalendarSource.PERSONAL,
          ] as CalendarSource[]);

    const publicSources = requestedSources.filter(
      (s) => s !== CalendarSource.PERSONAL,
    );
    const includePersonal = requestedSources.includes(CalendarSource.PERSONAL);

    sourceConditions = [];
    if (publicSources.length > 0) {
      sourceConditions.push({ source: { in: publicSources } });
    }
    if (includePersonal) {
      sourceConditions.push({
        source: CalendarSource.PERSONAL,
        createdById: userId,
      });
    }

    const where: Prisma.CalendarEntryWhereInput = {
      ...(Object.keys(dateFilter).length > 0 ? { startAt: dateFilter } : {}),
      ...tagsFilter,
      OR: sourceConditions,
    };

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

  async createPersonalEntry(
    userId: string,
    data: {
      title: string;
      description?: string;
      location?: string;
      startAt: string;
      endAt?: string;
      tags?: string[];
    },
  ) {
    return this.prisma.calendarEntry.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : undefined,
        tags: data.tags ?? [],
        source: CalendarSource.PERSONAL,
        createdById: userId,
      },
    });
  }

  async deleteEntry(userId: string, entryId: string) {
    const entry = await this.prisma.calendarEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) throw new NotFoundException('Calendar entry not found');
    if (entry.source !== CalendarSource.PERSONAL || entry.createdById !== userId) {
      throw new ForbiddenException('You can only delete your own personal entries');
    }

    await this.prisma.calendarEntry.delete({ where: { id: entryId } });
    return { success: true };
  }
}
