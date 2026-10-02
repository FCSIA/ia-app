import type {
  ClubChannelReaction,
  ClubChannelReactionInput,
} from "../validators";

export const CLUB_CHANNEL_REACTIONS = [
  { token: "LIKE", glyph: "👍" },
  { token: "HEART", glyph: "❤️" },
  { token: "FIRE", glyph: "🔥" },
  { token: "CELEBRATE", glyph: "🎉" },
  { token: "EYES", glyph: "👀" },
  { token: "DONE", glyph: "✅" },
  { token: "SKULL", glyph: "💀" },
] as const satisfies ReadonlyArray<{
  token: ClubChannelReaction;
  glyph: string;
}>;

const tokenByGlyph = new Map<string, ClubChannelReaction>(
  CLUB_CHANNEL_REACTIONS.map(({ token, glyph }) => [glyph, token]),
);
const tokens = new Set<ClubChannelReaction>(
  CLUB_CHANNEL_REACTIONS.map(({ token }) => token),
);

export function normalizeClubChannelReaction(
  value: ClubChannelReactionInput | string,
): ClubChannelReaction | null {
  if (tokens.has(value as ClubChannelReaction)) {
    return value as ClubChannelReaction;
  }
  return tokenByGlyph.get(value) ?? null;
}

export function clubChannelReactionStorageValues(
  reaction: ClubChannelReaction,
): [ClubChannelReaction, string] {
  const definition = CLUB_CHANNEL_REACTIONS.find(
    ({ token }) => token === reaction,
  );
  return [reaction, definition?.glyph ?? reaction];
}
