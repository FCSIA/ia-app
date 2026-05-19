import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';

describe('AuthService password changes', () => {
  function makeService() {
    const user = {
      id: 'user-1',
      uniqueId: 'STU001',
      firstName: 'Student',
      lastName: 'One',
      passwordHash: 'old-hash',
      roles: ['STUDENT'],
      isActive: true,
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
        update: jest.fn().mockResolvedValue({ ...user, passwordHash: 'new-hash' }),
      },
    };
    const jwt = { sign: jest.fn() };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };

    return {
      audit,
      prisma,
      service: new AuthService(prisma as never, jwt as never, audit as never),
    };
  }

  beforeEach(() => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
    jest.spyOn(bcrypt, 'hash').mockResolvedValue('new-hash' as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('lets signed-in users change their own admin-generated password from settings', async () => {
    const { service, prisma, audit } = makeService();

    await service.changePassword('user-1', {
      currentPassword: 'temporary-password',
      newPassword: 'student-owned-password',
    });

    expect(bcrypt.compare).toHaveBeenCalledWith('temporary-password', 'old-hash');
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { passwordHash: 'new-hash' },
    });
    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      actorId: 'user-1',
      action: 'AUTH_PASSWORD_CHANGED',
      entityId: 'user-1',
    }));
  });

  it('requires the current password before a signed-in user can change it', async () => {
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);
    const { service, prisma } = makeService();

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'wrong-password',
        newPassword: 'student-owned-password',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});
