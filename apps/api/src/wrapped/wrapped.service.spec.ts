import { Role } from '@prisma/client';
import {
  extractTopWord,
  longestMessageStreak,
  toEtDayKey,
  WrappedService,
  WRAPPED_SCHEMA_VERSION,
  type WrappedSummary,
} from './wrapped.service';
import type { PrismaService } from '../prisma/prisma.service';

type PrismaMock = Record<string, unknown>;

type WrappedServicePrivate = WrappedService & {
  generateAndStoreSnapshot: jest.Mock<Promise<WrappedSummary>, [string, number]>;
};

function buildService(prisma: PrismaMock) {
  return new WrappedService(prisma as unknown as PrismaService);
}

const baseSummary: WrappedSummary = {
  userId: 'user-1',
  schoolYearStart: 2025,
  schoolYearLabel: '2025-26',
  rangeStart: new Date(2025, 7, 1).toISOString(),
  rangeEnd: new Date(2026, 6, 31, 23, 59, 59, 999).toISOString(),
  messagesSent: 12,
  channelsEngaged: 2,
  friends: 3,
  clubs: 4,
  flexCredits: 5,
  flexCreditsRequired: 12,
  pathwayFlexCredits: 2,
  topChannel: null,
  topMentioned: null,
  pathway: {
    major: null,
    minor: null,
    lanyardColor: null,
    label: null,
    peers: 0,
  },
  mostUsedWord: { word: 'robotics', count: 4 },
  peakHour: { hour: 15, messages: 6 },
  longestStreak: 2,
  mostActiveDay: { date: '2026-04-15', messages: 6 },
  reactionsReceived: 8,
  topEmoji: { emoji: ':fire:', count: 3 },
  longestMessageChars: 140,
};

describe('WrappedService snapshots', () => {
  it('returns the stored current-version snapshot before rebuilding analytics', async () => {
    const prisma = {
      wrappedSnapshot: {
        findUnique: jest.fn().mockResolvedValue({
          schemaVersion: WRAPPED_SCHEMA_VERSION,
          summary: baseSummary,
        }),
      },
      clubChannelMessage: { findMany: jest.fn() },
    };
    const service = buildService(prisma);

    await expect(
      service.getWrapped('user-1', {
        requestedSchoolYear: 2025,
        userRoles: [Role.ADMIN],
      }),
    ).resolves.toEqual(baseSummary);

    expect(prisma.clubChannelMessage.findMany).not.toHaveBeenCalled();
  });

  it('generates and stores a missing snapshot for the requested user', async () => {
    const prisma = {
      wrappedSnapshot: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
    };
    const service = buildService(prisma) as WrappedServicePrivate;
    jest.spyOn(service, 'generateAndStoreSnapshot').mockResolvedValue(baseSummary);

    await expect(
      service.getWrapped('user-1', {
        requestedSchoolYear: 2025,
        userRoles: [Role.ADMIN],
      }),
    ).resolves.toEqual(baseSummary);

    expect(service.generateAndStoreSnapshot).toHaveBeenCalledWith('user-1', 2025);
  });

  it('skips current snapshots during admin generation unless refresh is requested', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'user-1' }, { id: 'user-2' }]),
      },
      wrappedSnapshot: {
        findMany: jest.fn().mockResolvedValue([{ userId: 'user-1' }]),
      },
    };
    const service = buildService(prisma) as WrappedServicePrivate;
    jest.spyOn(service, 'generateAndStoreSnapshot').mockResolvedValue(baseSummary);

    await expect(service.generateSnapshots({ schoolYear: 2025 })).resolves.toEqual({
      schoolYear: 2025,
      schemaVersion: WRAPPED_SCHEMA_VERSION,
      requested: 2,
      generated: 1,
      skipped: 1,
    });
    expect(service.generateAndStoreSnapshot).toHaveBeenCalledWith('user-2', 2025);

    service.generateAndStoreSnapshot.mockClear();
    await service.generateSnapshots({ schoolYear: 2025, refresh: true });
    expect(service.generateAndStoreSnapshot).toHaveBeenCalledTimes(2);
  });
});

describe('Wrapped analytics helpers', () => {
  it('filters filler words when extracting the top word', () => {
    expect(
      extractTopWord([
        'the the the robotics robotics',
        'https://example.com @leaders robotics design',
      ]),
    ).toEqual({ word: 'robotics', count: 3 });
  });

  it('computes the longest ET calendar-day message streak', () => {
    expect(
      longestMessageStreak([
        new Date('2026-04-01T14:00:00Z'),
        new Date('2026-04-02T14:00:00Z'),
        new Date('2026-04-04T14:00:00Z'),
      ]),
    ).toBe(2);
  });

  it('formats day keys in America/New_York', () => {
    expect(toEtDayKey(new Date('2026-04-02T02:30:00Z'))).toBe('2026-04-01');
  });
});
