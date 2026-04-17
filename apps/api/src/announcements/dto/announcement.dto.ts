import { IsString, IsEnum, IsOptional, IsBoolean, IsDateString, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { AnnouncementTarget, Pathway } from '@prisma/client';

export class CreateAnnouncementDto {
  @ApiProperty()
  @IsString()
  title: string;

  @ApiProperty()
  @IsString()
  body: string;

  @ApiProperty({ enum: AnnouncementTarget })
  @IsEnum(AnnouncementTarget)
  targetType: AnnouncementTarget;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  @IsInt()
  targetGrade?: number;

  @ApiProperty({ enum: Pathway, required: false })
  @IsOptional()
  @IsEnum(Pathway)
  targetPathway?: Pathway;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  clubId?: string;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  allowComments?: boolean;

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  isAdminGeneral?: boolean;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  body: string;
}
