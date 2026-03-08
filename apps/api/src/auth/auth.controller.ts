import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  SetMetadata,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { AuthService } from './auth.service';
import { LoginDto, ChangePasswordDto } from './dto/login.dto';
import { JwtAuthGuard, IS_PUBLIC_KEY } from './guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('auth')
@UseGuards(JwtAuthGuard)
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @SetMetadata(IS_PUBLIC_KEY, true)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @ApiBearerAuth()
  @Post('logout')
  logout(@CurrentUser() user: AuthenticatedUser, @Request() req: { headers: { authorization?: string } }) {
    const token = req.headers.authorization?.split(' ')[1];
    return this.authService.logout(user.id, token);
  }

  @ApiBearerAuth()
  @Post('change-password')
  changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(user.id, dto);
  }

  @ApiBearerAuth()
  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.getMe(user.id);
  }
}
