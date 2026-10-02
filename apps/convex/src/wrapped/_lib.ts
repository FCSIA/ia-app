import type { Pathway } from "../validators";

export const WRAPPED_SCHEMA_VERSION = 1;

export const WRAPPED_STUDENT_ROLES = [
  "STUDENT",
  "STUDENT_LEADER",
  "STUDENT_ADMIN",
] as const;

const STOPWORDS = new Set<string>([
  "the", "and", "for", "are", "but", "not", "you", "all", "can", "had",
  "her", "was", "one", "our", "out", "day", "get", "has", "him", "his",
  "how", "man", "new", "now", "old", "see", "two", "way", "who", "boy",
  "did", "its", "let", "put", "say", "she", "too", "use", "any", "ask",
  "yes", "yet", "why", "bit", "cuz", "lol", "omg", "idk", "tbh", "imo",
  "that", "this", "with", "have", "from", "they", "will", "your", "what",
  "when", "were", "been", "them", "than", "then", "some", "just", "into",
  "only", "also", "over", "very", "even", "back", "like", "want", "need",
  "here", "there", "well", "know", "make", "come", "take", "good", "time",
  "look", "work", "much", "such", "most", "more", "does", "dont", "cant",
  "going", "really", "yeah", "okay", "hey", "guys", "something", "about",
  "where", "which", "while", "every", "these", "those", "other", "stuff",
  "first", "next", "last", "long", "think", "https", "http", "message",
]);

export function schoolYearRange(startYear: number): { start: number; end: number } {
  const start = new Date(startYear, 7, 1).getTime();
  const end = new Date(startYear + 1, 6, 31, 23, 59, 59, 999).getTime();
  return { start, end };
}

export function schoolYearLabel(startYear: number): string {
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function wrappedAvailability(now: Date = new Date()): {
  open: boolean;
  schoolYear: number;
  opensAt: Date;
  closesAt: Date;
} {
  const year = now.getFullYear();
  const month = now.getMonth();

  if (month === 4) {
    return {
      open: true,
      schoolYear: year - 1,
      opensAt: new Date(year, 4, 1),
      closesAt: new Date(year, 4, 31, 23, 59, 59, 999),
    };
  }

  const nextOpensYear = month < 4 ? year : year + 1;
  return {
    open: false,
    schoolYear: nextOpensYear - 1,
    opensAt: new Date(nextOpensYear, 4, 1),
    closesAt: new Date(nextOpensYear, 4, 31, 23, 59, 59, 999),
  };
}

export function extractTopWord(bodies: string[]): { word: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const body of bodies) {
    if (!body) continue;
    const cleaned = body
      .replace(/https?:\/\/\S+/gi, " ")
      .replace(/@[A-Za-z0-9_.-]+/g, " ")
      .toLowerCase();
    for (const raw of cleaned.split(/[^a-z']+/)) {
      const word = raw.replace(/^'+|'+$/g, "");
      if (word.length < 3 || STOPWORDS.has(word)) continue;
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }
  let top: { word: string; count: number } | null = null;
  for (const [word, count] of counts) {
    if (!top || count > top.count) top = { word, count };
  }
  return top;
}

export function toEtDayKey(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

export function etHour(d: Date): number {
  const hourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "2-digit",
    hour12: false,
  }).format(d);
  const n = parseInt(hourStr, 10) % 24;
  return Number.isFinite(n) ? n : 0;
}

export function longestMessageStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const dayKeys = new Set<string>();
  for (const d of dates) dayKeys.add(toEtDayKey(d));
  const sorted = [...dayKeys].sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1] + "T12:00:00Z");
    const cur = new Date(sorted[i] + "T12:00:00Z");
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

export const PATHWAY_META: Record<
  Pathway,
  { label: string; lanyard: string }
> = {
  HEALTH_SCIENCE: { label: "Health Science", lanyard: "Green" },
  INFORMATION_TECHNOLOGY: { label: "Information Technology", lanyard: "Blue" },
  ENGINEERING: { label: "Engineering", lanyard: "Yellow" },
};

export type WrappedSummary = {
  userId: string;
  schoolYearStart: number;
  schoolYearLabel: string;
  rangeStart: string;
  rangeEnd: string;
  messagesSent: number;
  channelsEngaged: number;
  friends: number;
  clubs: number;
  flexCredits: number;
  flexCreditsRequired: number;
  pathwayFlexCredits: number;
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
    preferredName?: string;
    mentions: number;
  } | null;
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
};
