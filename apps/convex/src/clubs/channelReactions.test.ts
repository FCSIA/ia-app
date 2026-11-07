import { describe, expect, it } from "vitest";
import { clubChannelReactionStorageValues } from "./channelReactions";

describe("club channel reactions", () => {
  it("returns every stored representation used during toggles", () => {
    expect(clubChannelReactionStorageValues("CELEBRATE")).toEqual([
      "CELEBRATE",
      "🎉",
    ]);
  });
});
