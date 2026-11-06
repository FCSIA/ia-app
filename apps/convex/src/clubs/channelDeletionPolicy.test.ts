import { describe, expect, test } from "vitest";
import {
  CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE,
  hasMoreChannelMessageCleanup,
} from "./channelDeletionPolicy";

describe("club channel message deletion policy", () => {
  test("continues cleanup only when a relation batch exceeds its bound", () => {
    expect(
      hasMoreChannelMessageCleanup([
        CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE,
        0,
        1,
      ]),
    ).toBe(false);
    expect(
      hasMoreChannelMessageCleanup([
        0,
        CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE + 1,
      ]),
    ).toBe(true);
  });
});
