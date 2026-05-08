import {
  IsString,
  IsEnum,
  IsOptional,
  IsBoolean,
  IsDateString,
  IsInt,
  IsArray,
} from 'class-validator';
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

  @ApiProperty({ type: [Number], required: false })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  targetGrades?: number[];

  @ApiProperty({ enum: Pathway, required: false })
  @IsOptional()
  @IsEnum(Pathway)
  targetPathway?: Pathway;

  @ApiProperty({ enum: Pathway, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(Pathway, { each: true })
  targetMajorPathways?: Pathway[];

  @ApiProperty({ enum: Pathway, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(Pathway, { each: true })
  targetMinorPathways?: Pathway[];

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

  @ApiProperty({ required: false, default: false })
  @IsOptional()
  @IsBoolean()
  promoted?: boolean;
}

export class CreateCommentDto {
  @ApiProperty()
  @IsString()
  body: string;
}

export class RejectAnnouncementDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
