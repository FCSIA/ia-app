import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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

export class CreateClubChannelMessageDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  body: string;
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
