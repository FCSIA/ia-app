import { IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'STU001' })
  @IsString()
  @IsNotEmpty({ message: 'Please enter your Student or Staff ID.' })
  uniqueId: string;

  @ApiProperty({ example: 'password123' })
  @IsString()
  @IsNotEmpty({ message: 'Please enter your password.' })
  password: string;
}

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty({ message: 'Please enter your current password.' })
  currentPassword: string;

  @ApiProperty()
  @IsString()
  @MinLength(8, { message: 'Your new password must be at least 8 characters long.' })
  newPassword: string;
}
