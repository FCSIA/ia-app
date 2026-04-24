import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FlexAttendanceStatus, FriendshipStatus, Pathway, Role } from '@prisma/client';

/**
 * School year runs Aug 1 → Jul 31. Aug 2025 belongs to the 2025-26 school
 * year, i.e. startYear = 2025.
 */
function schoolYearStart(date: Date): number {
  return date.getMonth() >= 7 ? date.getFullYear() : date.getFullYear() - 1;
}

function schoolYearRange(startYear: number): { start: Date; end: Date } {
  const start = new Date(startYear, 7, 1);
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Wrapped is only available during May of each school year. June and July
 * close the door on the just-finished year; August kicks off a new tracking
 * period that stays hidden until the following May. This mirrors how the
 * user-facing "Spotify Wrapped" style moment should only unlock once, at the
 * end of the year it's summarising.
 */
export function wrappedAvailability(now: Date = new Date()): {
  open: boolean;
  /** The school year startYear this window covers (when open). */
  schoolYear: number;
  /** When this May window opens. */
  opensAt: Date;
  /** When this May window closes (end of May 31). */
  closesAt: Date;
} {
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  // The May window of calendar year Y summarises the school year that started
  // in August Y-1. Outside May we surface the *next* upcoming window.
  if (month === 4) {
    return {
      open: true,
      schoolYear: year - 1,
      opensAt: new Date(year, 4, 1),
      closesAt: new Date(year, 4, 31, 23, 59, 59, 999),
    };
  }

  // Before May (Jan–Apr): next window is May of this calendar year.
  // From June onward: next window is May of next calendar year.
  const nextOpensYear = month < 4 ? year : year + 1;
  return {
    open: false,
    schoolYear: nextOpensYear - 1,
    opensAt: new Date(nextOpensYear, 4, 1),
    closesAt: new Date(nextOpensYear, 4, 31, 23, 59, 59, 999),
  };
}

export interface WrappedAvailability {
  open: boolean;
  schoolYear: number;
  schoolYearLabel: string;
  opensAt: string;
  closesAt: string;
  /** Seconds from now until `opensAt`. Negative when open. */
  secondsUntilOpen: number;
}

// ─── Stopwords for "most used word" ────────────────────────────────────────
// Common English filler + chat noise. Words must be >2 chars to count, so
// "a", "to", "i", etc. are already excluded by length — this list targets
// 3+ char words that would otherwise dominate the output.
const STOPWORDS = new Set<string>([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had',
  'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his',
  'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy',
  'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'any', 'ask',
  'yes', 'yet', 'why', 'bit', 'cuz', 'lol', 'omg', 'idk', 'tbh', 'imo',
  'fyi', 'smh', 'nah', 'yea', 'yup', 'yep', 'nope', 'ngl', 'rly', 'bro',
  'that', 'this', 'with', 'have', 'from', 'they', 'will', 'your', 'what',
  'when', 'were', 'been', 'them', 'than', 'then', 'some', 'just', 'into',
  'only', 'also', 'over', 'very', 'even', 'back', 'like', 'want', 'need',
  'here', 'there', 'well', 'know', 'make', 'come', 'take', 'good', 'time',
  'look', 'work', 'much', 'such', 'most', 'more', 'does', 'dont', 'cant',
  'didnt', 'wont', 'gonna', 'wanna', 'still', 'because', 'would', 'could',
  'should', 'going', 'really', 'yeah', 'okay', 'hey', 'guys', 'gonna',
  'kinda', 'sorta', 'maybe', 'probably', 'actually', 'literally',
  'something', 'anything', 'someone', 'anyone', 'everyone', 'about',
  'where', 'which', 'while', 'being', 'every', 'these', 'those', 'other',
  'same', 'both', 'each', 'many', 'made', 'said', 'thing', 'things',
  'stuff', 'first', 'next', 'last', 'long', 'think', 'https', 'http',
  'com', 'www', 'message', 'messages',
]);

function extractTopWord(bodies: string[]): { word: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    if (!body) continue;
    // Drop @mention tokens and URLs before splitting.
    const cleaned = body
      .replace(/https?:\/\/\S+/gi, ' ')
      .replace(/@[A-Za-z0-9_.-]+/g, ' ')
      .toLowerCase();
    const tokens = cleaned.split(/[^a-z']+/);
    for (const raw of tokens) {
      const word = raw.replace(/^'+|'+$/g, '');
      if (word.length < 3) continue;
      if (STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  let top: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (!top || count > top.count) top = { word, count };
  }
  return top;
}

/**
 * Longest consecutive run of calendar days (in ET) with at least one message.
 */
function longestMessageStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const dayKeys = new Set<string>();
  for (const d of dates) dayKeys.add(toEtDayKey(d));
  const sorted = [...dayKeys].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + 'T12:00:00Z');
    const cur = new Date(sorted[i] + 'T12:00:00Z');
    const diffDays = Math.round((cur.getTime() - prev.getTime()) / 86_400_000);
    if (diffDays === 1) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 1;
    }
  }
  return longest;
}

/** ISO-ish YYYY-MM-DD in America/New_York. */
function toEtDayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d);
  const y = parts.find((p) => p.type === 'year')?.value ?? '0000';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const day = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${day}`;
}

function etHour(d: Date): number {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour: '2-digit',
    hour12: false,
  }).format(d);
  // Intl gives back something like "03" or "24"; normalise.
  const n = parseInt(hourStr, 10) % 24;
  return Number.isFinite(n) ? n : 0;
}

export interface WrappedSummary {
  userId: string;
  schoolYearStart: number;
  schoolYearLabel: string;
  rangeStart: string;
  rangeEnd: string;

  // Core activity
  messagesSent: number;
  channelsEngaged: number;
  friends: number;
  clubs: number;

  // Flex Fridays
  flexCredits: number;
  flexCreditsRequired: number;
  pathwayFlexCredits: number;

  // Highlights
  topChannel: {
    channelId: string;
    channelName: string;
    clubId: string;
    clubName: string;
    messages: number;
  } | null;
  topMentioned: {
    userId: string;
    firstName: string;
    lastName: string;
    mentions: number;
  } | null;

  // New in this drop:
  pathway: {
    major: Pathway | null;
    minor: Pathway | null;
    lanyardColor: string | null;
    label: string | null;
    peers: number;
  };
  mostUsedWord: { word: string; count: number } | null;
  peakHour: { hour: number; messages: number } | null;
  longestStreak: number;
  mostActiveDay: { date: string; messages: number } | null;
  reactionsReceived: number;
  topEmoji: { emoji: string; count: number } | null;
  longestMessageChars: number;
}

const PATHWAY_META: Record<Pathway, { label: string; lanyard: string }> = {
  HEALTH_SCIENCE: { label: 'Health Science', lanyard: 'Green' },
  INFORMATION_TECHNOLOGY: { label: 'Information Technology', lanyard: 'Blue' },
  ENGINEERING: { label: 'Engineering', lanyard: 'Yellow' },
};

@Injectable()
export class WrappedService {
  constructor(private prisma: PrismaService) {}

  getAvailability(): WrappedAvailability {
    const now = new Date();
    const a = wrappedAvailability(now);
    return {
      open: a.open,
      schoolYear: a.schoolYear,
      schoolYearLabel: `${a.schoolYear}-${String((a.schoolYear + 1) % 100).padStart(2, '0')}`,
      opensAt: a.opensAt.toISOString(),
      closesAt: a.closesAt.toISOString(),
      secondsUntilOpen: Math.round((a.opensAt.getTime() - now.getTime()) / 1000),
    };
  }

  async getWrapped(
    userId: string,
    opts: { requestedSchoolYear?: number; userRoles?: Role[] } = {},
  ): Promise<WrappedSummary> {
    const now = new Date();
    const availability = wrappedAvailability(now);
    const isAdmin =
      opts.userRoles?.includes(Role.ADMIN) || opts.userRoles?.includes(Role.SUPER_ADMIN);

    if (!availability.open && !isAdmin) {
      throw new ForbiddenException({
        message: 'Wrapped opens in May.',
        code: 'WRAPPED_CLOSED',
        opensAt: availability.opensAt.toISOString(),
        closesAt: availability.closesAt.toISOString(),
        schoolYear: availability.schoolYear,
      });
    }

    // Default to the school year this Wrapped window is summarising — the one
    // that started the prior August. Lets admins still target any year.
    const startYear = opts.requestedSchoolYear ?? availability.schoolYear;
    const { start, end } = schoolYearRange(startYear);
    const label = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;

    // Pull all of the user's messages in the window once; most of the new
    // stats are cheap to compute in memory from this one result set.
    const userMessagesPromise = this.prisma.clubChannelMessage.findMany({
      where: { authorId: userId, createdAt: { gte: start, lte: end } },
      select: { id: true, createdAt: true, body: true, channelId: true },
    });

    const userPromise = this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, major: true, minor: true },
    });

    const [
      userMessages,
      user,
      flexCreditsRaw,
      acceptedFriends,
      clubs,
      topChannelGroup,
      topMentionedGroup,
      topEmojiGroup,
      reactionsReceived,
    ] = await Promise.all([
      userMessagesPromise,
      userPromise,
      this.prisma.flexAttendance.count({
        where: {
          studentId: userId,
          status: FlexAttendanceStatus.PRESENT,
          flexFriday: { date: { gte: start, lte: end } },
        },
      }),
      this.prisma.studentScheduleFriend.count({
        where: {
          status: FriendshipStatus.ACCEPTED,
          acceptedAt: { gte: start, lte: end },
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      this.prisma.clubMember.count({
        where: { userId, joinedAt: { lte: end } },
      }),
      this.prisma.clubChannelMessage.groupBy({
        by: ['channelId'],
        where: { authorId: userId, createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        orderBy: { _count: { channelId: 'desc' } },
        take: 1,
      }),
      this.prisma.clubChannelMessageMention.groupBy({
        by: ['userId'],
        where: {
          userId: { not: null },
          message: { authorId: userId, createdAt: { gte: start, lte: end } },
        },
        _count: { _all: true },
        orderBy: { _count: { userId: 'desc' } },
        take: 1,
      }),
      this.prisma.clubChannelMessageReaction.groupBy({
        by: ['emoji'],
        where: { userId, createdAt: { gte: start, lte: end } },
        _count: { _all: true },
        orderBy: { _count: { emoji: 'desc' } },
        take: 1,
      }),
      this.prisma.clubChannelMessageReaction.count({
        where: {
          message: { authorId: userId, createdAt: { gte: start, lte: end } },
        },
      }),
    ]);

    // ─── Derive stats from the loaded message set ────────────────────────
    const messagesSent = userMessages.length;
    const channelsEngaged = new Set(userMessages.map((m) => m.channelId)).size;

    // Peak hour (ET).
    const hourCounts = new Array<number>(24).fill(0);
    const dayCounts = new Map<string, number>();
    let longestMessageChars = 0;
    for (const m of userMessages) {
      hourCounts[etHour(m.createdAt)] += 1;
      const dk = toEtDayKey(m.createdAt);
      dayCounts.set(dk, (dayCounts.get(dk) ?? 0) + 1);
      if (m.body && m.body.length > longestMessageChars) longestMessageChars = m.body.length;
    }
    let peakHour: WrappedSummary['peakHour'] = null;
    if (messagesSent > 0) {
      let bestHour = 0;
      for (let h = 1; h < 24; h++) if (hourCounts[h] > hourCounts[bestHour]) bestHour = h;
      peakHour = { hour: bestHour, messages: hourCounts[bestHour] };
    }

    let mostActiveDay: WrappedSummary['mostActiveDay'] = null;
    for (const [date, n] of dayCounts) {
      if (!mostActiveDay || n > mostActiveDay.messages) {
        mostActiveDay = { date, messages: n };
      }
    }

    const longestStreak = longestMessageStreak(userMessages.map((m) => m.createdAt));
    const mostUsedWord = extractTopWord(userMessages.map((m) => m.body));

    // Pathway-scoped Flex credits: attendance in workshops that targeted the
    // user's major pathway. Falls back to 0 if no major set.
    let pathwayFlexCredits = 0;
    if (user?.major) {
      pathwayFlexCredits = await this.prisma.flexAttendance.count({
        where: {
          studentId: userId,
          status: FlexAttendanceStatus.PRESENT,
          flexFriday: { date: { gte: start, lte: end } },
          workshop: { targetMajorPathways: { has: user.major } },
        },
      });
    }

    // Pathway peers (same major, excluding self).
    let pathwayPeers = 0;
    if (user?.major) {
      pathwayPeers = await this.prisma.user.count({
        where: { major: user.major, id: { not: userId }, isActive: true },
      });
    }

    // ─── Resolve grouped lookups ────────────────────────────────────────
    let topChannel: WrappedSummary['topChannel'] = null;
    if (topChannelGroup.length > 0) {
      const top = topChannelGroup[0];
      const channel = await this.prisma.clubChannel.findUnique({
        where: { id: top.channelId },
        select: { id: true, name: true, club: { select: { id: true, name: true } } },
      });
      if (channel) {
        topChannel = {
          channelId: channel.id,
          channelName: channel.name,
          clubId: channel.club.id,
          clubName: channel.club.name,
          messages: top._count._all,
        };
      }
    }

    let topMentioned: WrappedSummary['topMentioned'] = null;
    if (topMentionedGroup.length > 0) {
      const top = topMentionedGroup[0];
      if (top.userId) {
        const target = await this.prisma.user.findUnique({
          where: { id: top.userId },
          select: { id: true, firstName: true, lastName: true },
        });
        if (target) {
          topMentioned = {
            userId: target.id,
            firstName: target.firstName,
            lastName: target.lastName,
            mentions: top._count._all,
          };
        }
      }
    }

    const topEmoji: WrappedSummary['topEmoji'] =
      topEmojiGroup.length > 0
        ? { emoji: topEmojiGroup[0].emoji, count: topEmojiGroup[0]._count._all }
        : null;

    const major = user?.major ?? null;
    const minor = user?.minor ?? null;
    const pathway: WrappedSummary['pathway'] = {
      major,
      minor,
      lanyardColor: major ? PATHWAY_META[major].lanyard : null,
      label: major ? PATHWAY_META[major].label : null,
      peers: pathwayPeers,
    };

    return {
      userId,
      schoolYearStart: startYear,
      schoolYearLabel: label,
      rangeStart: start.toISOString(),
      rangeEnd: end.toISOString(),
      messagesSent,
      flexCredits: flexCreditsRaw,
      flexCreditsRequired: 12,
      pathwayFlexCredits,
      channelsEngaged,
      friends: acceptedFriends,
      clubs,
      topChannel,
      topMentioned,
      pathway,
      mostUsedWord,
      peakHour,
      longestStreak,
      mostActiveDay,
      reactionsReceived,
      topEmoji,
      longestMessageChars,
    };
  }
}
