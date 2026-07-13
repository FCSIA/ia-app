import { describe, expect, test } from "vitest";
import {
  CHANNEL_MESSAGE_CLEANUP_BATCH_SIZE,
  deletedChannelMessagePatch,
  hasMoreChannelMessageCleanup,
  shouldRetainDeletedChannelMessage,
} from "./channelDeletionPolicy";

describe("club channel message deletion policy", () => {
  test("removes message content while retaining deletion metadata", () => {
    expect(deletedChannelMessagePatch(123)).toEqual({
      body: "",
      bodyMarkdown: undefined,
      bodyRich: undefined,
      isPinned: false,
      pinnedAt: undefined,
      pollQuestion: undefined,
      pollOptions: undefined,
      deletedAt: 123,
      updatedAt: 123,
    });
  });

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

  test("retains tombstones only while they anchor replies", () => {
    expect(shouldRetainDeletedChannelMessage(true)).toBe(true);
    expect(shouldRetainDeletedChannelMessage(false)).toBe(false);
  });
});
