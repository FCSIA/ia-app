import { PATHWAY_LABELS } from "../../../shared/labels";
import { schoolDateKey } from "../../../shared/school-time";
import type { Pathway } from "../validators";

export const WRAPPED_SCHEMA_VERSION = 1;

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

export function longestMessageStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;
  const dayKeys = new Set<string>();
  for (const d of dates) dayKeys.add(schoolDateKey(d));
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
  HEALTH_SCIENCE: { label: PATHWAY_LABELS.HEALTH_SCIENCE, lanyard: "Green" },
  INFORMATION_TECHNOLOGY: { label: PATHWAY_LABELS.INFORMATION_TECHNOLOGY, lanyard: "Blue" },
  ENGINEERING: { label: PATHWAY_LABELS.ENGINEERING, lanyard: "Yellow" },
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
