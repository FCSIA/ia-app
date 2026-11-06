/**
 * The club-chat contract between the server and its clients. The server
 * enforces these values; web and mobile use the same ones to warn early.
 */

/** Reactions travel and are stored as tokens; glyphs are how they render. */
export const CHAT_REACTIONS = [
  { token: "LIKE", glyph: "👍", name: "Like" },
  { token: "HEART", glyph: "❤️", name: "Love" },
  { token: "FIRE", glyph: "🔥", name: "Fire" },
  { token: "CELEBRATE", glyph: "🎉", name: "Celebrate" },
  { token: "EYES", glyph: "👀", name: "Watching" },
  { token: "DONE", glyph: "✅", name: "Done" },
  { token: "SKULL", glyph: "💀", name: "Skull" },
] as const;

export type ChatReactionDefinition = (typeof CHAT_REACTIONS)[number];
export type ChatReaction = ChatReactionDefinition["token"];

export function isChatReaction(value: string): value is ChatReaction {
  return CHAT_REACTIONS.some((reaction) => reaction.token === value);
}

/** Older mobile builds sent glyphs, so stored rows may hold either form. */
export function chatReactionDefinition(value: string): ChatReactionDefinition | null {
  return (
    CHAT_REACTIONS.find(
      (reaction) => reaction.token === value || reaction.glyph === value,
    ) ?? null
  );
}

export function normalizeChatReaction(value: string): ChatReaction | null {
  return chatReactionDefinition(value)?.token ?? null;
}

/** Server limits count code points (`Array.from(text).length`). */
export const MAX_CHANNEL_MESSAGE_BODY_CHARACTERS = 4_000;
export const MAX_CHANNEL_MESSAGE_MARKDOWN_CHARACTERS = 12_000;
export const MAX_CHANNEL_POLL_QUESTION_CHARACTERS = 240;
export const MAX_CHANNEL_POLL_OPTIONS = 6;
export const MAX_CHANNEL_POLL_OPTION_LABEL_CHARACTERS = 120;

/** Channel search returns at most this many messages. */
export const MAX_CHANNEL_SEARCH_RESULTS = 30;

/** A typing heartbeat keeps someone "typing" this long; clients ping at this interval. */
export const CHANNEL_TYPING_TTL_MS = 2_000;

/**
 * Consecutive posts by one author group under one header within this window.
 * Web and mobile chose different windows; keeping both until product picks one.
 */
export const WEB_MESSAGE_GROUP_WINDOW_MS = 7 * 60 * 1000;
export const MOBILE_MESSAGE_GROUP_WINDOW_MS = 5 * 60 * 1000;

/** Mentions are Markdown links whose target names the person: `[@Alex](user://AB123)`. */
export const MENTION_URL_PROTOCOL = "user:";

export function mentionHref(token: string) {
  return `${MENTION_URL_PROTOCOL}//${token}`;
}

export function isMentionHref(href: string) {
  return href.startsWith(`${MENTION_URL_PROTOCOL}//`);
}

/** Matches every mention link in Markdown; group 1 is the mention token. */
export const MENTION_MARKDOWN_LINK = /\[[^\]]*\]\(user:\/\/([A-Za-z0-9_-]+)\)/g;

/**
 * An inline Markdown image (`![alt](url)` or `![alt][ref]`); group 1 is the alt
 * text. Chat disallows these, so clients strip them and the server rejects them.
 */
export const INLINE_MARKDOWN_IMAGE_SOURCE = String.raw`!\[([^\]]*)\]\s*(?:\([^)]*\)|\[[^\]]*\])`;

/** Client-only rows wait under this id prefix until the server returns a real id. */
export const OPTIMISTIC_ID_PREFIX = "optimistic:";

export function optimisticMessageId(clientGeneratedId: string) {
  return `${OPTIMISTIC_ID_PREFIX}${clientGeneratedId}`;
}

export function isOptimisticId(id: string) {
  return id.startsWith(OPTIMISTIC_ID_PREFIX);
}

export const CHANNEL_VISIBILITIES = ["PUBLIC", "PRIVATE", "MEMBER_READONLY"] as const;
export type ChannelVisibility = (typeof CHANNEL_VISIBILITIES)[number];

export const CHANNEL_VISIBILITY_LABELS: Record<ChannelVisibility, string> = {
  PUBLIC: "Public",
  PRIVATE: "Private",
  MEMBER_READONLY: "Read only",
};

export const CHANNEL_VISIBILITY_DESCRIPTIONS: Record<ChannelVisibility, string> = {
  PUBLIC: "Every club member can read and post here.",
  PRIVATE: "Only selected members, sponsors, and admins can read and post.",
  MEMBER_READONLY: "All members can read, but only leaders, sponsors, and admins can post.",
};
