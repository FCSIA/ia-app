import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ContentType, ReportStatus, Role } from '@prisma/client';
import { ModerationService } from './moderation.service';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
export class ModerationController {
  constructor(private moderationService: ModerationService) {}

  // Keyword management — admin only
  @Get('keywords')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getKeywords() {
    return this.moderationService.getKeywords();
  }

  @Post('keywords')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  addKeyword(@Body() body: { keyword: string }, @CurrentUser() user: any) {
    return this.moderationService.addKeyword(body.keyword, user.id);
  }

  @Patch('keywords/:id/remove')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  removeKeyword(@Param('id') id: string, @CurrentUser() user: any) {
    return this.moderationService.removeKeyword(id, user.id);
  }

  @Get('keyword-matches')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  getKeywordMatches() {
    return this.moderationService.getKeywordMatches();
  }

  // Reports
  @Get('reports')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF)
  getReports(@Query('status') status?: ReportStatus) {
    return this.moderationService.getReports(status);
  }

  @Post('reports')
  submitReport(
    @Body() body: { contentType: ContentType; contentId: string; reason: string; reportedUserId?: string },
    @CurrentUser() user: any,
  ) {
    return this.moderationService.submitReport(
      user.id,
      body.contentType,
      body.contentId,
      body.reason,
      body.reportedUserId,
    );
  }

  @Patch('reports/:id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF)
  updateReport(
    @Param('id') id: string,
    @Body() body: { status: ReportStatus; reviewNote: string },
    @CurrentUser() user: any,
  ) {
    return this.moderationService.updateReportStatus(id, body.status, body.reviewNote, user.id);
  }
}
