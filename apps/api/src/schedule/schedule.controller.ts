import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AddScheduleFriendDto,
  CreateSchoolDayBlockDto,
  UpdateSchoolDayBlockDto,
  UpsertStudentScheduleDto,
} from './dto/schedule.dto';
import { ScheduleService } from './schedule.service';

@ApiTags('schedule')
@ApiBearerAuth()
@Controller('schedule')
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Get()
  getDashboard(@CurrentUser() user: any) {
    return this.scheduleService.getDashboard(user);
  }

  @Put('me')
  upsertMySchedule(@CurrentUser() user: any, @Body() dto: UpsertStudentScheduleDto) {
    return this.scheduleService.upsertMySchedule(user, dto);
  }

  @Get('search')
  searchPeople(@CurrentUser() user: any, @Query('q') query?: string) {
    return this.scheduleService.searchPeople(user, query ?? '');
  }

  @Post('friends')
  addFriend(@CurrentUser() user: any, @Body() dto: AddScheduleFriendDto) {
    return this.scheduleService.addFriend(user, dto.friendId);
  }

  @Delete('friends/:friendId')
  removeFriend(@CurrentUser() user: any, @Param('friendId') friendId: string) {
    return this.scheduleService.removeFriend(user, friendId);
  }

  @Post('blocks')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  createBlock(@CurrentUser() user: any, @Body() dto: CreateSchoolDayBlockDto) {
    return this.scheduleService.createBlock(user.id, dto);
  }

  @Patch('blocks/:blockId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  updateBlock(
    @CurrentUser() user: any,
    @Param('blockId') blockId: string,
    @Body() dto: UpdateSchoolDayBlockDto,
  ) {
    return this.scheduleService.updateBlock(blockId, user.id, dto);
  }

  @Delete('blocks/:blockId')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deleteBlock(@CurrentUser() user: any, @Param('blockId') blockId: string) {
    return this.scheduleService.deleteBlock(blockId, user.id);
  }
}
