import type { ChatReaction, QuickReaction } from "./types";

export const QUICK_REACTIONS: ReadonlyArray<{
  payload: QuickReaction;
  label: string;
  glyph: string;
}> = [
  { payload: "LIKE", label: "Like", glyph: "👍" },
  { payload: "HEART", label: "Love", glyph: "❤️" },
  { payload: "FIRE", label: "Fire", glyph: "🔥" },
  { payload: "CELEBRATE", label: "Celebrate", glyph: "🎉" },
  { payload: "EYES", label: "Watching", glyph: "👀" },
  { payload: "DONE", label: "Done", glyph: "✅" },
];

const REACTION_PAYLOADS = new Set<QuickReaction>(
  QUICK_REACTIONS.map((reaction) => reaction.payload),
);
const REACTION_PAYLOAD_BY_GLYPH = new Map(
  QUICK_REACTIONS.map((reaction) => [reaction.glyph, reaction.payload]),
);

export function normalizeReactionPayload(value: string): QuickReaction | null {
  if (REACTION_PAYLOADS.has(value as QuickReaction)) {
    return value as QuickReaction;
  }
  return REACTION_PAYLOAD_BY_GLYPH.get(value) ?? null;
}

export function reactionDefinition(value: string) {
  const payload = normalizeReactionPayload(value);
  return payload
    ? QUICK_REACTIONS.find((reaction) => reaction.payload === payload) ?? null
    : null;
}

export function normalizeReactionSummaries(reactions: ChatReaction[]) {
  const normalized = new Map<QuickReaction | string, ChatReaction>();
  for (const reaction of reactions) {
    const key = normalizeReactionPayload(reaction.emoji) ?? reaction.emoji;
    const previous = normalized.get(key);
    normalized.set(key, {
      emoji: key,
      count: (previous?.count ?? 0) + reaction.count,
      reactedByCurrentUser:
        (previous?.reactedByCurrentUser ?? false) ||
        reaction.reactedByCurrentUser,
      countIsCapped:
        (previous?.countIsCapped ?? false) || (reaction.countIsCapped ?? false),
    });
  }
  return [...normalized.values()];
}
