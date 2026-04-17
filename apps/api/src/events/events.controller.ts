import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { EventsService } from './events.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('events')
@ApiBearerAuth()
@Controller('events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Get()
  getAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('clubId') clubId?: string,
  ) {
    return this.eventsService.getAll(user.id, user.role, clubId);
  }

  @Get('pending-approvals')
  getPendingApprovals(@CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.getPendingApprovals(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.getOne(id, user.id, user.role);
  }

  @Post()
  create(
    @Body()
    body: {
      title: string;
      description?: string;
      location?: string;
      flyerUrl?: string;
      startAt: string;
      endAt?: string;
      clubId?: string;
    },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventsService.create(body, user.id, user.role);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventsService.approveOrReject(id, user.id, 'approve', body.note);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() body: { note?: string },
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.eventsService.approveOrReject(id, user.id, 'reject', body.note);
  }

  @Patch(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.eventsService.cancel(id, user.id, user.role);
  }
}
