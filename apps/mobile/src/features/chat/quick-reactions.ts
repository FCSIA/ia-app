import { normalizeChatReaction } from "~/apps/shared/chat/protocol";
import type { ChatReaction } from "./types";

export function normalizeReactionSummaries(reactions: ChatReaction[]) {
  const normalized = new Map<string, ChatReaction>();
  for (const reaction of reactions) {
    const key = normalizeChatReaction(reaction.emoji) ?? reaction.emoji;
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
