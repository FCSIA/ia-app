import { describe, expect, test } from "vitest";
import type { Id } from "../_generated/dataModel";
import {
  MAX_CHANNEL_MESSAGE_PAGE_SIZE,
  boundedChannelMessagePageSize,
  chronologicalFromNewest,
  threadRootIdForMessage,
} from "./channelPagination";

describe("club channel pagination", () => {
  test("bounds requested page sizes", () => {
    expect(boundedChannelMessagePageSize(0)).toBe(1);
    expect(boundedChannelMessagePageSize(24.8)).toBe(24);
    expect(boundedChannelMessagePageSize(Number.POSITIVE_INFINITY)).toBe(30);
    expect(boundedChannelMessagePageSize(10_000)).toBe(MAX_CHANNEL_MESSAGE_PAGE_SIZE);
  });

  test("turns a newest-first storage window into chronological display order", () => {
    expect(chronologicalFromNewest(["newest", "middle", "oldest"])).toEqual([
      "oldest",
      "middle",
      "newest",
    ]);
  });

  test("resolves direct replies to their root message", () => {
    const rootId = "root" as Id<"clubChannelMessages">;
    const replyId = "reply" as Id<"clubChannelMessages">;

    expect(threadRootIdForMessage({ _id: rootId, parentMessageId: undefined })).toBe(rootId);
    expect(threadRootIdForMessage({ _id: replyId, parentMessageId: rootId })).toBe(rootId);
  });
});
