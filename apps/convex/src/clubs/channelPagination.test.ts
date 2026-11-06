import { describe, expect, test } from "vitest";
import {
  MAX_CHANNEL_MESSAGE_PAGE_SIZE,
  boundedChannelMessagePageSize,
  chronologicalFromNewest,
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
});
