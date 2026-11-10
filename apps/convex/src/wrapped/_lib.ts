import { PATHWAY_LABELS } from "../../../shared/labels";
import { schoolDateKey } from "../../../shared/school-time";
import { v, type Infer } from "convex/values";
import { pathwayValidator, type Pathway } from "../validators";

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

export const wrappedSummaryValidator = v.object({
  userId: v.string(),
  schoolYearStart: v.number(),
  schoolYearLabel: v.string(),
  rangeStart: v.string(),
  rangeEnd: v.string(),
  messagesSent: v.number(),
  channelsEngaged: v.number(),
  friends: v.number(),
  clubs: v.number(),
  flexCredits: v.number(),
  flexCreditsRequired: v.number(),
  pathwayFlexCredits: v.number(),
  topChannel: v.union(
    v.object({
      channelId: v.string(),
      channelName: v.string(),
      clubId: v.string(),
      clubName: v.string(),
      messages: v.number(),
    }),
    v.null(),
  ),
  topMentioned: v.union(
    v.object({
      userId: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      preferredName: v.optional(v.string()),
      mentions: v.number(),
    }),
    v.null(),
  ),
  pathway: v.object({
    major: v.union(pathwayValidator, v.null()),
    minor: v.union(pathwayValidator, v.null()),
    lanyardColor: v.union(v.string(), v.null()),
    label: v.union(v.string(), v.null()),
    peers: v.number(),
  }),
  mostUsedWord: v.union(
    v.object({ word: v.string(), count: v.number() }),
    v.null(),
  ),
  peakHour: v.union(
    v.object({ hour: v.number(), messages: v.number() }),
    v.null(),
  ),
  longestStreak: v.number(),
  mostActiveDay: v.union(
    v.object({ date: v.string(), messages: v.number() }),
    v.null(),
  ),
  reactionsReceived: v.number(),
  topEmoji: v.union(
    v.object({ emoji: v.string(), count: v.number() }),
    v.null(),
  ),
  longestMessageChars: v.number(),
});

export type WrappedSummary = Infer<typeof wrappedSummaryValidator>;
