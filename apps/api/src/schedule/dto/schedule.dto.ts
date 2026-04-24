import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScheduleWeekday } from '@prisma/client';

export enum SchoolDayBlockKind {
  PERIOD = 'PERIOD',
  CUSTOM = 'CUSTOM',
}

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class StudentScheduleEntryDto {
  @ApiProperty({ enum: ScheduleWeekday })
  @IsEnum(ScheduleWeekday)
  weekday: ScheduleWeekday;

  @ApiProperty({ minimum: 1, maximum: 8 })
  @IsInt()
  @Min(1)
  @Max(8)
  periodNumber: number;

  @ApiProperty({ example: 'cmabc123course' })
  @IsString()
  @MinLength(1)
  courseId: string;
}

export class UpsertStudentScheduleDto {
  @ApiProperty()
  @IsBoolean()
  isPublic: boolean;

  @ApiProperty({ type: [StudentScheduleEntryDto] })
  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => StudentScheduleEntryDto)
  entries: StudentScheduleEntryDto[];
}

export class AddScheduleFriendDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  friendId: string;
}

export class CreateSchoolDayBlockDto {
  @ApiProperty({ enum: ScheduleWeekday })
  @IsEnum(ScheduleWeekday)
  weekday: ScheduleWeekday;

  @ApiProperty({ enum: SchoolDayBlockKind })
  @IsEnum(SchoolDayBlockKind)
  kind: SchoolDayBlockKind;

  @ApiPropertyOptional({ minimum: 1, maximum: 8 })
  @ValidateIf((value: CreateSchoolDayBlockDto) => value.kind === SchoolDayBlockKind.PERIOD)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  periodNumber?: number;

  @ApiPropertyOptional()
  @ValidateIf((value: CreateSchoolDayBlockDto) => value.kind === SchoolDayBlockKind.CUSTOM)
  @IsString()
  @MinLength(1)
  label?: string;

  @ApiProperty({ example: '08:10' })
  @Matches(TIME_PATTERN)
  startTime: string;

  @ApiProperty({ example: '08:58' })
  @Matches(TIME_PATTERN)
  endTime: string;
}

export class UpdateSchoolDayBlockDto {
  @ApiPropertyOptional({ enum: ScheduleWeekday })
  @IsOptional()
  @IsEnum(ScheduleWeekday)
  weekday?: ScheduleWeekday;

  @ApiPropertyOptional({ enum: SchoolDayBlockKind })
  @IsOptional()
  @IsEnum(SchoolDayBlockKind)
  kind?: SchoolDayBlockKind;

  @ApiPropertyOptional({ minimum: 1, maximum: 8 })
  @ValidateIf((value: UpdateSchoolDayBlockDto) => value.kind === SchoolDayBlockKind.PERIOD || value.periodNumber !== undefined)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(8)
  periodNumber?: number;

  @ApiPropertyOptional()
  @ValidateIf((value: UpdateSchoolDayBlockDto) => value.kind === SchoolDayBlockKind.CUSTOM || value.label !== undefined)
  @IsString()
  @MinLength(1)
  label?: string;

  @ApiPropertyOptional({ example: '08:10' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  startTime?: string;

  @ApiPropertyOptional({ example: '08:58' })
  @IsOptional()
  @Matches(TIME_PATTERN)
  endTime?: string;
}
