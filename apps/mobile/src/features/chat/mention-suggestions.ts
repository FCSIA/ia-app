import type { ClubMentionContext } from "./types";
import type { ChatMentionSuggestion } from "./mention-format";

const RESERVED_MENTION_TOKENS = new Set(["all", "leaders", "sponsors"]);

export function buildChatMentionSuggestions(
  context: ClubMentionContext | null | undefined,
): ChatMentionSuggestion[] {
  if (!context) return [];

  const builtIns: ChatMentionSuggestion[] = [
    ...(context.canMentionEveryone
      ? [
          {
            token: "all",
            label: "Everyone in this channel",
            displayText: "@all",
            detail: "Everyone who can read this channel",
          },
        ]
      : []),
    {
      token: "sponsors",
      label: "Club sponsors",
      displayText: "@sponsors",
      detail: "Sponsors",
    },
  ];
  const tags = context.tags
    .filter((tag) => !RESERVED_MENTION_TOKENS.has(tag.slug.toLowerCase()))
    .map((tag) => ({
      token: tag.slug,
      label: tag.name,
      displayText: `@${tag.name}`,
      detail: "Mention group",
    }));
  const people = context.members.map((person) => {
    const name =
      [person.firstName, person.lastName].filter(Boolean).join(" ") || "Member";
    return {
      token: person.uniqueId,
      label: name,
      displayText: `@${name}`,
      detail: "Club member",
    };
  });

  return [...builtIns, ...tags, ...people];
}
