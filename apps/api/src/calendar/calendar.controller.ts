import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { Role } from '@prisma/client';
import { CalendarService } from './calendar.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('calendar')
@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private calendarService: CalendarService) {}

  @Get()
  getEntries(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('tags') tags?: string,
  ) {
    const tagList = tags ? tags.split(',') : undefined;
    return this.calendarService.getEntries(startDate, endDate, tagList);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF, Role.TEACHER, Role.STUDENT)
  createManual(
    @Body()
    body: {
      title: string;
      description?: string;
      location?: string;
      startAt: string;
      endAt?: string;
      tags?: string[];
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.calendarService.createManual(body, user.id);
  }
}
