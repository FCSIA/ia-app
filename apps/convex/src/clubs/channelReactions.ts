import { CHAT_REACTIONS } from "../../../shared/chat/protocol";
import type { ClubChannelReaction } from "../validators";

/** Every stored form of a reaction: legacy rows may hold the glyph instead of the token. */
export function clubChannelReactionStorageValues(
  reaction: ClubChannelReaction,
): [ClubChannelReaction, string] {
  const definition = CHAT_REACTIONS.find(({ token }) => token === reaction);
  return [reaction, definition?.glyph ?? reaction];
}
