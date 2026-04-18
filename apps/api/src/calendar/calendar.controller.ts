import { Controller, Get, Post, Delete, Body, Query, Param } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { CalendarSource } from '@prisma/client';
import { CalendarService } from './calendar.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get()
  getEntries(
    @CurrentUser() user: AuthenticatedUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tags') tags?: string,
    @Query('sources') sources?: string,
  ) {
    const tagList = tags ? tags.split(',') : undefined;
    const sourceList = sources
      ? (sources.split(',').filter((s) =>
          Object.values(CalendarSource).includes(s as CalendarSource),
        ) as CalendarSource[])
      : undefined;
    return this.calendarService.getEntries(user.id, startDate, endDate, tagList, sourceList);
  }

  @Post()
  createPersonalEntry(
    @CurrentUser() user: AuthenticatedUser,
    @Body()
    body: {
      title: string;
      description?: string;
      location?: string;
      startAt: string;
      endAt?: string;
      tags?: string[];
    },
  ) {
    return this.calendarService.createPersonalEntry(user.id, body);
  }

  @Delete(':id')
  deleteEntry(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return this.calendarService.deleteEntry(user.id, id);
  }
}
