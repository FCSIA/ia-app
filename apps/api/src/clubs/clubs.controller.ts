import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { ClubChannelsService } from './club-channels.service';
import { ClubInvitationsService } from './club-invitations.service';
import { ClubManagementService } from './club-management.service';
import {
  AddClubSponsorDto,
  CreateClubChannelDto,
  CreateClubChannelMessageDto,
  CreateClubDto,
  CreateClubTagDto,
  InviteClubMemberDto,
  RespondToClubInviteDto,
  UpdateClubDto,
} from './dto/club.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('clubs')
@ApiBearerAuth()
@Controller('clubs')
export class ClubsController {
  constructor(
    private readonly clubManagement: ClubManagementService,
    private readonly clubInvitations: ClubInvitationsService,
    private readonly clubChannels: ClubChannelsService,
  ) {}

  @Get()
  getAll() {
    return this.clubManagement.getAll();
  }

  @Get('my')
  getMyClubs(@CurrentUser() user: any) {
    return this.clubManagement.getMyClubs(user.id);
  }

  @Get('my/invites')
  getMyInvites(@CurrentUser() user: any) {
    return this.clubInvitations.getMyInvites(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clubManagement.getOne(id, user.id, user.role);
  }

  @Get(':id/channels')
  getChannels(@Param('id') clubId: string, @CurrentUser() user: any) {
    return this.clubChannels.getChannels(clubId, user.id, user.role);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(
    @Body() body: CreateClubDto,
    @CurrentUser() user: any,
  ) {
    return this.clubManagement.create(body, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: UpdateClubDto,
    @CurrentUser() user: any,
  ) {
    return this.clubManagement.update(id, body, user.id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.clubManagement.deactivate(id, user.id);
  }

  @Post(':id/channels')
  createChannel(
    @Param('id') clubId: string,
    @Body() body: CreateClubChannelDto,
    @CurrentUser() user: any,
  ) {
    return this.clubChannels.createChannel(clubId, body, user.id, user.role);
  }

  @Post(':id/tags')
  createTag(
    @Param('id') clubId: string,
    @Body() body: CreateClubTagDto,
    @CurrentUser() user: any,
  ) {
    return this.clubChannels.createTag(clubId, body, user.id, user.role);
  }

  @Get(':id/channels/:channelId/messages')
  getChannelMessages(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @CurrentUser() user: any,
  ) {
    return this.clubChannels.getChannelMessages(clubId, channelId, user.id, user.role);
  }

  @Post(':id/channels/:channelId/messages')
  postChannelMessage(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @Body() body: CreateClubChannelMessageDto,
    @CurrentUser() user: any,
  ) {
    return this.clubChannels.postChannelMessage(clubId, channelId, body, user.id, user.role);
  }

  @Post(':id/invite')
  sendInvite(
    @Param('id') clubId: string,
    @Body() body: InviteClubMemberDto,
    @CurrentUser() user: any,
  ) {
    return this.clubInvitations.sendInvite(clubId, body.uniqueId, user.id, user.role);
  }

  @Post(':id/invite/csv')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  bulkInviteFromCsv(
    @Param('id') clubId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: any,
  ) {
    if (!file) throw new BadRequestException('CSV file is required');
    return this.clubInvitations.bulkInviteFromCsv(clubId, file.buffer, user.id, user.role);
  }

  @Post('invites/:inviteId/respond')
  respondToInvite(
    @Param('inviteId') inviteId: string,
    @Body() body: RespondToClubInviteDto,
    @CurrentUser() user: any,
  ) {
    return this.clubInvitations.respondToInvite(inviteId, body.accept, user.id);
  }

  @Post(':id/members/:memberId/promote')
  promoteMember(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.clubManagement.promoteMember(clubId, memberId, user.id, user.role);
  }

  @Post(':id/members/:memberId/remove')
  removeMember(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
  ) {
    return this.clubManagement.removeMember(clubId, memberId, user.id, user.role);
  }

  @Post(':id/sponsors')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  addSponsor(
    @Param('id') clubId: string,
    @Body() body: AddClubSponsorDto,
    @CurrentUser() user: any,
  ) {
    return this.clubManagement.addSponsor(clubId, body.sponsorId, user.id);
  }
}
