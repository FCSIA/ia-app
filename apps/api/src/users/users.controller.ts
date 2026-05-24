import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Header,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags, ApiConsumes } from '@nestjs/swagger';
import type { AuthenticatedUser } from '@ia/contracts/auth';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto, UpdateUserDto, AssignRolesDto } from './dto/user.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF)
  findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('roleGroup') roleGroup?: string,
  ) {
    return this.usersService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 50,
      search,
      roleGroup,
    );
  }

  @Get('export/csv')
  @Roles(Role.SUPER_ADMIN)
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="students.csv"')
  exportStudentsCsv() {
    return this.usersService.exportStudentsCsv();
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN, Role.SUPPORT_STAFF)
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.create(dto, user.id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.update(id, dto, user.id);
  }

  @Patch(':id/roles')
  @Roles(Role.SUPER_ADMIN)
  assignRoles(@Param('id') id: string, @Body() dto: AssignRolesDto, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.assignRoles(id, dto, user.id);
  }

  @Patch(':id/deactivate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  deactivate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.deactivate(id, user.id, user.role);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  activate(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.activate(id, user.id);
  }

  @Post(':id/reset-password')
  @Roles(Role.ADMIN, Role.SUPER_ADMIN)
  resetPassword(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.usersService.resetPassword(id, user.id, user.role ?? undefined);
  }

  @Post('import/csv')
  @Roles(Role.SUPER_ADMIN)
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(
    @UploadedFile() file: Express.Multer.File,
    @Body('generatePasswords') generatePasswords: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    if (!file) throw new BadRequestException('CSV file is required');

    return this.usersService.importFromCsv(file.buffer, user.id, {
      generatePasswords: generatePasswords === 'true',
    });
  }

  @Get('me/dashboard-layout')
  getDashboardLayout(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.getDashboardLayout(user.id);
  }

  @Patch('me/dashboard-layout')
  updateDashboardLayout(
    @CurrentUser() user: AuthenticatedUser,
    @Body('layout') layout: string[],
  ) {
    if (!Array.isArray(layout)) throw new BadRequestException('Layout must be an array of widget IDs');
    return this.usersService.updateDashboardLayout(user.id, layout);
  }
}
