import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  BadRequestException,
  UploadedFile,
  UseInterceptors,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { Role } from '@prisma/client';
import { ClubChannelsService } from './club-channels.service';
import { ClubInvitationsService } from './club-invitations.service';
import { ClubManagementService } from './club-management.service';
import {
  AddClubSponsorDto,
  CreateClubChannelDto,
  UpdateClubChannelDto,
  CreateClubChannelMessageDto,
  CreateClubDto,
  CreateClubTagDto,
  InviteClubMemberDto,
  RedeemClubJoinCodeDto,
  RespondToClubInviteDto,
  RespondToClubJoinRequestDto,
  SetClubMemberRoleDto,
  ToggleClubChannelReactionDto,
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
  getMyClubs(@CurrentUser() user: AuthenticatedUser) {
    return this.clubManagement.getMyClubs(user.id);
  }

  @Get('my/invites')
  getMyInvites(@CurrentUser() user: AuthenticatedUser) {
    return this.clubInvitations.getMyInvites(user.id);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clubManagement.getOne(id, user.id, user.role);
  }

  @Post(':id/join')
  joinClub(@Param('id') clubId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clubInvitations.joinOpenClub(clubId, user.id);
  }

  @Post(':id/request-join')
  requestToJoin(@Param('id') clubId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clubInvitations.requestToJoin(clubId, user.id);
  }

  @Post(':id/join-code/redeem')
  redeemJoinCode(
    @Param('id') clubId: string,
    @Body() body: RedeemClubJoinCodeDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubInvitations.redeemJoinCode(clubId, user.id, body.code);
  }

  @Post(':id/join-code')
  generateJoinCode(
    @Param('id') clubId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubInvitations.generateJoinCode(clubId, user.id, user.role);
  }

  @Post(':id/join-requests/:requestId/respond')
  respondToJoinRequest(
    @Param('id') clubId: string,
    @Param('requestId') requestId: string,
    @Body() body: RespondToClubJoinRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubInvitations.respondToJoinRequest(
      clubId,
      requestId,
      body.accept,
      user.id,
      user.role,
    );
  }

  @Get(':id/channels')
  getChannels(@Param('id') clubId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clubChannels.getChannels(clubId, user.id, user.role);
  }

  @Post()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  create(
    @Body() body: CreateClubDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubManagement.create(body, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(
    @Param('id') id: string,
    @Body() body: UpdateClubDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubManagement.update(id, body, user.id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.clubManagement.deactivate(id, user.id);
  }

  @Post(':id/channels')
  createChannel(
    @Param('id') clubId: string,
    @Body() body: CreateClubChannelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.createChannel(clubId, body, user.id, user.role);
  }

  @Patch(':id/channels/:channelId')
  @ApiOperation({ summary: 'Update a club channel' })
  updateChannel(
    @Param('id') id: string,
    @Param('channelId') channelId: string,
    @Body() dto: UpdateClubChannelDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.updateChannel(id, channelId, dto, user.id, user.role);
  }

  @Post(':id/tags')
  createTag(
    @Param('id') clubId: string,
    @Body() body: CreateClubTagDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.createTag(clubId, body, user.id, user.role);
  }

  @Delete(':id/channels/:channelId')
  deleteChannel(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.deleteChannel(clubId, channelId, user.id, user.role);
  }

  @Get(':id/channels/:channelId/messages')
  getChannelMessages(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.getChannelMessages(clubId, channelId, user.id, user.role);
  }

  @Post(':id/channels/:channelId/messages')
  postChannelMessage(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @Body() body: CreateClubChannelMessageDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.postChannelMessage(clubId, channelId, body, user.id, user.role);
  }

  @Post(':id/channels/:channelId/messages/:messageId/reactions')
  toggleChannelReaction(
    @Param('id') clubId: string,
    @Param('channelId') channelId: string,
    @Param('messageId') messageId: string,
    @Body() body: ToggleClubChannelReactionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubChannels.toggleReaction(
      clubId,
      channelId,
      messageId,
      body,
      user.id,
      user.role,
    );
  }

  @Post(':id/invite')
  sendInvite(
    @Param('id') clubId: string,
    @Body() body: InviteClubMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubInvitations.sendInvite(clubId, body.uniqueId, user.id, user.role);
  }

  @Post(':id/invite/csv')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  bulkInviteFromCsv(
    @Param('id') clubId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('CSV file is required');
    return this.clubInvitations.bulkInviteFromCsv(clubId, file.buffer, user.id, user.role);
  }

  @Post('invites/:inviteId/respond')
  respondToInvite(
    @Param('inviteId') inviteId: string,
    @Body() body: RespondToClubInviteDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubInvitations.respondToInvite(inviteId, body.accept, user.id);
  }

  @Patch(':id/members/:memberId/role')
  setMemberRole(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @Body() body: SetClubMemberRoleDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubManagement.setMemberRole(clubId, memberId, body.role, user.id, user.role);
  }

  @Post(':id/members/:memberId/remove')
  removeMember(
    @Param('id') clubId: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubManagement.removeMember(clubId, memberId, user.id, user.role);
  }

  @Post(':id/sponsors')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  addSponsor(
    @Param('id') clubId: string,
    @Body() body: AddClubSponsorDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.clubManagement.addSponsor(clubId, body.sponsorId, user.id);
  }
}
