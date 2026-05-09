import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsObject,
  IsString,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ClubChannelVisibility, ClubJoinPolicy } from '@prisma/client';

export class CreateClubDto {
  @ApiProperty({ example: 'Robotics Club' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ClubJoinPolicy, default: ClubJoinPolicy.OPEN })
  @IsOptional()
  joinPolicy?: ClubJoinPolicy;

  @ApiProperty({ type: [String], description: 'At least one sponsor is required' })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  sponsorIds: string[];
}

export class UpdateClubDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ClubJoinPolicy })
  @IsOptional()
  joinPolicy?: ClubJoinPolicy;

  @ApiPropertyOptional({ description: 'Public URL to the club logo image' })
  @IsOptional()
  @IsString()
  logoUrl?: string | null;

  @ApiPropertyOptional({ description: 'Public URL to the club banner image' })
  @IsOptional()
  @IsString()
  bannerUrl?: string | null;

  @ApiPropertyOptional({ description: 'Accent color (hex) used on the club hero' })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  accentColor?: string | null;

  @ApiPropertyOptional({ description: 'Long-form club overview / description for the home tab' })
  @IsOptional()
  @IsString()
  overview?: string | null;
}

export class AddClubSponsorDto {
  @ApiProperty()
  @IsString()
  sponsorId: string;
}

class ClubPeopleSelectionDto {
  @ApiPropertyOptional({ type: [String], description: 'Preferred for UI selection from current club people' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberIds?: string[];

  @ApiPropertyOptional({ type: [String], description: 'Backward-compatible selection by uniqueId' })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsString({ each: true })
  memberUniqueIds?: string[];
}

export class CreateClubChannelDto extends ClubPeopleSelectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ClubChannelVisibility, default: ClubChannelVisibility.PUBLIC })
  @IsOptional()
  @IsEnum(ClubChannelVisibility)
  visibility?: ClubChannelVisibility;
}

export class UpdateClubChannelDto extends ClubPeopleSelectionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ClubChannelVisibility })
  @IsOptional()
  @IsEnum(ClubChannelVisibility)
  visibility?: ClubChannelVisibility;
}

export class CreateClubTagDto extends ClubPeopleSelectionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;
}

export class ClubChannelMessageAttachmentDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  fileName: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  fileUrl: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mimeType?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000_000)
  size?: number;
}

export class ClubChannelPollOptionDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  id: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(180)
  label: string;
}

export class CreateClubChannelMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @IsObject({ each: true })
  bodyRich?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  parentMessageId?: string;

  @ApiPropertyOptional({ type: [ClubChannelMessageAttachmentDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClubChannelMessageAttachmentDto)
  attachments?: ClubChannelMessageAttachmentDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(240)
  pollQuestion?: string;

  @ApiPropertyOptional({ type: [ClubChannelPollOptionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ClubChannelPollOptionDto)
  pollOptions?: ClubChannelPollOptionDto[];
}

export class ToggleClubChannelMessagePinDto {
  @ApiProperty()
  @IsBoolean()
  pinned: boolean;
}

export class VoteClubChannelPollDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  optionId: string;
}

export class ToggleClubChannelReactionDto {
  @ApiProperty({ example: '🔥' })
  @IsString()
  @MinLength(1)
  @MaxLength(16)
  emoji: string;
}

export class InviteClubMemberDto {
  @ApiProperty({ example: 'STU001' })
  @IsString()
  @MinLength(1)
  uniqueId: string;
}

export class SetClubMemberRoleDto {
  @ApiPropertyOptional({ example: 'President', description: 'Clears the role when omitted or blank.' })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  role?: string | null;
}

export class RespondToClubInviteDto {
  @ApiProperty()
  @IsBoolean()
  accept: boolean;
}

export class RedeemClubJoinCodeDto {
  @ApiProperty()
  @IsString()
  @MinLength(4)
  code: string;
}

export class RespondToClubJoinRequestDto {
  @ApiProperty()
  @IsBoolean()
  accept: boolean;
}
