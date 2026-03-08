import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  MinLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateClubDto {
  @ApiProperty({ example: 'Robotics Club' })
  @IsString()
  @MinLength(2)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isPrivate?: boolean;
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

export class CreateClubChannelMessageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  body?: string;

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

export class RespondToClubInviteDto {
  @ApiProperty()
  accept: boolean;
}
