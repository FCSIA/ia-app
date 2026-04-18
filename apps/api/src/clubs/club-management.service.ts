import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma/prisma.service';
import { ClubAccessPolicy } from './club-access.policy';
import { CreateClubDto, UpdateClubDto } from './dto/club.dto';

const SPONSOR_ELIGIBLE_ROLES: Role[] = [
  Role.TEACHER,
  Role.SUPPORT_STAFF,
  Role.ADMIN,
  Role.SUPER_ADMIN,
];

@Injectable()
export class ClubManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly accessPolicy: ClubAccessPolicy,
  ) {}

  private buildDirectory(club: {
    members: Array<{
      role: string | null;
      joinedAt: Date;
      user: { id: string; uniqueId: string; firstName: string; lastName: string };
    }>;
    sponsors: Array<{
      addedAt: Date;
      user: { id: string; uniqueId: string | null; firstName: string; lastName: string };
    }>;
  }) {
    const sponsorEntries = club.sponsors.map((sponsor) => ({
      id: sponsor.user.id,
      uniqueId: sponsor.user.uniqueId,
      firstName: sponsor.user.firstName,
      lastName: sponsor.user.lastName,
      kind: 'SPONSOR' as const,
      clubRole: null,
      joinedAt: sponsor.addedAt,
    }));

    const memberEntries = club.members.map((member) => ({
      id: member.user.id,
      uniqueId: member.user.uniqueId,
      firstName: member.user.firstName,
      lastName: member.user.lastName,
      kind: 'MEMBER' as const,
      clubRole: member.role,
      joinedAt: member.joinedAt,
    }));

    return [...sponsorEntries, ...memberEntries].sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'SPONSOR' ? -1 : 1;
      if (left.kind === 'MEMBER' && right.kind === 'MEMBER') {
        const leftHasRole = !!left.clubRole;
        const rightHasRole = !!right.clubRole;
        if (leftHasRole !== rightHasRole) return leftHasRole ? -1 : 1;
      }
      return `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`);
    });
  }

  private normalizeClubRole(role?: string | null) {
    const normalized = role?.trim() ?? '';
    return normalized.length > 0 ? normalized : null;
  }

  private async validateSponsorSelection(sponsorIds: string[]) {
    const normalizedIds = Array.from(new Set(sponsorIds.map((value) => value.trim()).filter(Boolean)));
    if (normalizedIds.length === 0) {
      throw new BadRequestException('At least one sponsor is required');
    }

    const sponsors = await this.prisma.user.findMany({
      where: {
        id: { in: normalizedIds },
        isActive: true,
        roles: { hasSome: SPONSOR_ELIGIBLE_ROLES },
      },
      select: { id: true },
    });

    if (sponsors.length !== normalizedIds.length) {
      throw new BadRequestException('Every sponsor must be an active staff member');
    }

    return sponsors.map((sponsor) => sponsor.id);
  }

  async getAll() {
    return this.prisma.club.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { members: true, channels: true } },
        sponsors: {
          include: {
            user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
          },
        },
      },
    });
  }

  async getMyClubs(userId: string) {
    const [memberships, sponsoring] = await Promise.all([
      this.prisma.clubMember.findMany({
        where: { userId },
        include: { club: { include: { _count: { select: { members: true, channels: true } } } } },
      }),
      this.prisma.clubSponsor.findMany({
        where: { userId },
        include: { club: { include: { _count: { select: { members: true, channels: true } } } } },
      }),
    ]);

    return {
      memberOf: memberships.map((membership) => ({ ...membership.club, role: membership.role })),
      sponsoring: sponsoring.map((entry) => entry.club),
    };
  }

  async getOne(id: string, userId: string, userRole: string) {
    const viewer = await this.accessPolicy.getViewerContext(id, userId, userRole);

    if (viewer.canAccessWorkspace) {
      const club = await this.prisma.club.findUnique({
        where: { id },
        include: {
          members: {
            include: {
              user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
            },
            orderBy: { user: { firstName: 'asc' } },
          },
          sponsors: {
            include: {
              user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
            },
            orderBy: { user: { firstName: 'asc' } },
          },
          tags: {
            include: {
              members: {
                include: {
                  user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
                },
              },
            },
            orderBy: { name: 'asc' },
          },
          joinRequests: viewer.canManageMembership
            ? {
                where: { status: 'PENDING' },
                include: {
                  requester: {
                    select: { id: true, uniqueId: true, firstName: true, lastName: true },
                  },
                },
                orderBy: { createdAt: 'asc' },
              }
            : false,
          _count: { select: { members: true, channels: true, tags: true } },
        },
      });
      if (!club) throw new NotFoundException('Club not found');

      const channels = await this.accessPolicy.getVisibleChannels(id, userId, userRole);
      const pendingJoinRequests = ((club as any).joinRequests ?? []).map((request: any) => ({
        id: request.id,
        status: request.status,
        createdAt: request.createdAt.toISOString(),
        requester: request.requester,
      }));
      return {
        ...club,
        joinCode: undefined,
        viewer,
        channels,
        directory: this.buildDirectory(club),
        leaders: club.members.filter((member) => !!member.role?.trim()),
        activeJoinCode: viewer.canManageMembership && club.joinCode
          ? {
              code: club.joinCode,
              updatedAt: club.joinCodeUpdatedAt?.toISOString() ?? null,
            }
          : null,
        pendingJoinRequests,
      };
    }

    const club = await this.prisma.club.findUnique({
      where: { id },
      include: {
        members: {
          where: { role: { not: null } },
          include: {
            user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
          },
          orderBy: { user: { firstName: 'asc' } },
        },
        sponsors: {
          include: {
            user: { select: { id: true, uniqueId: true, firstName: true, lastName: true } },
          },
          orderBy: { user: { firstName: 'asc' } },
        },
        _count: { select: { members: true, channels: true, tags: true } },
      },
    });
    if (!club) throw new NotFoundException('Club not found');

    return {
      ...club,
      viewer,
      members: [],
      channels: [],
      tags: [],
      directory: [],
      leaders: club.members.filter((member) => !!member.role?.trim()),
      activeJoinCode: null,
      pendingJoinRequests: [],
    };
  }

  async create(dto: CreateClubDto, actorId: string) {
    const sponsorIds = await this.validateSponsorSelection(dto.sponsorIds);

    const club = await this.prisma.club.create({
      data: {
        name: dto.name.trim(),
        description: dto.description?.trim() || undefined,
        joinPolicy: dto.joinPolicy ?? 'OPEN',
        sponsors: {
          create: sponsorIds.map((sponsorId) => ({ userId: sponsorId })),
        },
      },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_CREATED',
      entityType: 'Club',
      entityId: club.id,
      meta: { name: club.name, sponsorIds },
    });

    return club;
  }

  async update(id: string, dto: UpdateClubDto, actorId: string) {
    const normalizeNullable = (value: string | null | undefined) => {
      if (value === undefined) return undefined;
      if (value === null) return null;
      const trimmed = value.trim();
      return trimmed.length === 0 ? null : trimmed;
    };

    const club = await this.prisma.club.update({
      where: { id },
      data: {
        name: dto.name?.trim(),
        description: dto.description?.trim(),
        joinPolicy: dto.joinPolicy,
        logoUrl: normalizeNullable(dto.logoUrl),
        bannerUrl: normalizeNullable(dto.bannerUrl),
        accentColor: normalizeNullable(dto.accentColor),
        overview: normalizeNullable(dto.overview),
      },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_UPDATED',
      entityType: 'Club',
      entityId: id,
    });

    return club;
  }

  async deactivate(id: string, actorId: string) {
    await this.prisma.club.update({ where: { id }, data: { isActive: false } });
    await this.audit.log({
      actorId,
      action: 'CLUB_DEACTIVATED',
      entityType: 'Club',
      entityId: id,
    });
    return { success: true };
  }

  async addSponsor(clubId: string, sponsorId: string, actorId: string) {
    const [club, eligibleSponsorIds] = await Promise.all([
      this.prisma.club.findUnique({ where: { id: clubId }, select: { id: true } }),
      this.validateSponsorSelection([sponsorId]),
    ]);
    if (!club) throw new NotFoundException('Club not found');

    await this.prisma.clubSponsor.upsert({
      where: { clubId_userId: { clubId, userId: eligibleSponsorIds[0] } },
      update: {},
      create: { clubId, userId: eligibleSponsorIds[0] },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_SPONSOR_ADDED',
      entityType: 'Club',
      entityId: clubId,
      meta: { sponsorId: eligibleSponsorIds[0] },
    });

    return { success: true };
  }

  async setMemberRole(
    clubId: string,
    memberId: string,
    role: string | null | undefined,
    actorId: string,
    actorRole: string,
  ) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageMembership) {
      throw new ForbiddenException('Only club role holders, sponsors, or admins can assign club roles');
    }

    const normalizedRole = this.normalizeClubRole(role);

    await this.prisma.clubMember.update({
      where: { clubId_userId: { clubId, userId: memberId } },
      data: { role: normalizedRole },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_MEMBER_ROLE_SET',
      entityType: 'Club',
      entityId: clubId,
      meta: { memberId, role: normalizedRole },
    });

    return { success: true };
  }

  async removeMember(clubId: string, memberId: string, actorId: string, actorRole: string) {
    const context = await this.accessPolicy.getClubContext(clubId, actorId, actorRole);
    if (!context.canManageMembership) {
      throw new ForbiddenException('Only club role holders, sponsors, or admins can remove members');
    }

    await this.prisma.clubMember.delete({
      where: { clubId_userId: { clubId, userId: memberId } },
    });

    await this.audit.log({
      actorId,
      action: 'CLUB_MEMBER_REMOVED',
      entityType: 'Club',
      entityId: clubId,
      meta: { memberId },
    });

    return { success: true };
  }
}
