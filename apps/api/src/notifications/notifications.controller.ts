import { Controller, Get, Post, Patch, Body, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { NotificationCategory } from '@prisma/client';
import { NotificationsService } from './notifications.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private notificationsService: NotificationsService) {}

  @Get()
  getMyNotifications(
    @CurrentUser() user: any,
    @Query('unreadOnly') unreadOnly?: string,
  ) {
    return this.notificationsService.getMyNotifications(user.id, unreadOnly === 'true');
  }

  @Get('unread-count')
  getUnreadCount(@CurrentUser() user: any) {
    return this.notificationsService.getUnreadCount(user.id);
  }

  @Post('mark-read')
  markRead(@CurrentUser() user: any, @Body() body: { ids: string[] }) {
    return this.notificationsService.markRead(user.id, body.ids);
  }

  @Post('mark-all-read')
  markAllRead(@CurrentUser() user: any) {
    return this.notificationsService.markAllRead(user.id);
  }

  @Get('preferences')
  getPreferences(@CurrentUser() user: any) {
    return this.notificationsService.getPreferences(user.id);
  }

  @Post('preferences')
  upsertPreference(
    @CurrentUser() user: any,
    @Body() body: { category: NotificationCategory; enabled: boolean; clubId?: string },
  ) {
    return this.notificationsService.upsertPreference(
      user.id,
      body.category,
      body.enabled,
      body.clubId,
    );
  }
}
