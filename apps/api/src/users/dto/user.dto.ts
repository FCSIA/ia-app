import { IsString, IsEmail, IsOptional, IsEnum, IsArray, MinLength, IsInt } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role, Pathway } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ example: 'STU001' })
  @IsString()
  uniqueId: string;

  @ApiProperty()
  @IsString()
  firstName: string;

  @ApiProperty()
  @IsString()
  lastName: string;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  @IsInt()
  gradeLevel?: number;

  @ApiProperty({ enum: Pathway, required: false })
  @IsOptional()
  @IsEnum(Pathway)
  major?: Pathway;

  @ApiProperty({ enum: Pathway, required: false })
  @IsOptional()
  @IsEnum(Pathway)
  minor?: Pathway;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiProperty({ enum: Role, isArray: true, required: false })
  @IsOptional()
  @IsArray()
  @IsEnum(Role, { each: true })
  roles?: Role[];
}

export class UpdateUserDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ type: Number, required: false })
  @IsOptional()
  @IsInt()
  gradeLevel?: number;

  @ApiProperty({ enum: Pathway, required: false })
  @IsOptional()
  @IsEnum(Pathway)
  major?: Pathway;

  @ApiProperty({ enum: Pathway, required: false })
  @IsOptional()
  @IsEnum(Pathway)
  minor?: Pathway;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsEmail()
  email?: string;
}

export class AssignRolesDto {
  @ApiProperty({ enum: Role, isArray: true })
  @IsArray()
  @IsEnum(Role, { each: true })
  roles: Role[];
}

