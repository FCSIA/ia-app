import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto, CreateCommentDto } from './dto/announcement.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('announcements')
@ApiBearerAuth()
@Controller('announcements')
export class AnnouncementsController {
  constructor(private announcementsService: AnnouncementsService) {}

  @Get()
  getAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('archived') archived?: string,
    @Query('clubId') clubId?: string,
  ) {
    return this.announcementsService.getAll(user.id, user.role, archived === 'true', clubId);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.getOne(id, user.id, user.role);
  }

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.create(dto, user.id, user.role);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.archive(id, user.id, user.role);
  }

  @Post(':id/comments')
  addComment(
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.announcementsService.addComment(id, dto, user.id);
  }

  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.announcementsService.deleteComment(commentId, user.id, user.role);
  }
}
