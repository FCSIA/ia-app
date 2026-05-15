import { ForbiddenException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { Role } from '@prisma/client';
import { UsersService } from './users.service';

describe('UsersService password reset authorization', () => {
  const targetUser = (roles: Role[]) => ({
    id: 'target-1',
    uniqueId: 'TARGET001',
    firstName: 'Target',
    lastName: 'User',
    email: null,
    gradeLevel: null,
    major: null,
    minor: null,
    passwordHash: 'old-hash',
    roles,
    isActive: true,
    dashboardLayout: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  function makeService(roles: Role[]) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(targetUser(roles)),
        update: jest.fn().mockResolvedValue(targetUser(roles)),
      },
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    return {
      prisma,
      audit,
      service: new UsersService(prisma as never, audit as never),
    };
  }

  beforeEach(() => {
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows admins to reset passwords for non-admin accounts', async () => {
    const { service, prisma, audit } = makeService([Role.TEACHER]);

    await expect(
      service.resetPassword('target-1', 'temporary-password', 'admin-1', [Role.ADMIN]),
    ).resolves.toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: { passwordHash: 'new-hash' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'admin-1',
      action: 'USER_PASSWORD_RESET',
      entityId: 'target-1',
    }));
  });

  it('blocks admins from resetting admin accounts', async () => {
    const { service, prisma, audit } = makeService([Role.ADMIN]);

    await expect(
      service.resetPassword('target-1', 'temporary-password', 'admin-1', [Role.ADMIN]),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('blocks admins from resetting super-admin accounts', async () => {
    const { service, prisma, audit } = makeService([Role.SUPER_ADMIN, Role.ADMIN]);

    await expect(
      service.resetPassword('target-1', 'temporary-password', 'admin-1', [Role.ADMIN]),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.user.update).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('allows super admins to reset privileged accounts explicitly', async () => {
    const { service, prisma } = makeService([Role.ADMIN]);

    await expect(
      service.resetPassword('target-1', 'temporary-password', 'super-1', [Role.SUPER_ADMIN]),
    ).resolves.toEqual({ success: true });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'target-1' },
      data: { passwordHash: 'new-hash' },
    });
  });
});
