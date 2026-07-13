import { describe, expect, it } from "vitest";
import {
  clubChannelReactionStorageValues,
  normalizeClubChannelReaction,
} from "./channelReactions";

describe("club channel reactions", () => {
  it("keeps canonical payloads stable", () => {
    expect(normalizeClubChannelReaction("FIRE")).toBe("FIRE");
    expect(normalizeClubChannelReaction("HEART")).toBe("HEART");
  });

  it("normalizes legacy display glyphs", () => {
    expect(normalizeClubChannelReaction("🔥")).toBe("FIRE");
    expect(normalizeClubChannelReaction("❤️")).toBe("HEART");
    expect(normalizeClubChannelReaction("😂")).toBeNull();
  });

  it("returns every stored representation used during toggles", () => {
    expect(clubChannelReactionStorageValues("CELEBRATE")).toEqual([
      "CELEBRATE",
      "🎉",
    ]);
  });
});
