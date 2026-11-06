import { describe, expect, test } from "vitest";
import {
  resistedReplySwipeDistance,
  shouldTriggerSwipeReply,
  SWIPE_REPLY_THRESHOLD,
} from "./swipe-reply";

describe("swipe to reply", () => {
  test("replies once the threshold is reached, or on a fast short leftward flick", () => {
    expect(shouldTriggerSwipeReply(-10, -100, true)).toBe(true);
    expect(shouldTriggerSwipeReply(-10, -100, false)).toBe(false);
    expect(shouldTriggerSwipeReply(-40, -2_000, false)).toBe(true);
    expect(shouldTriggerSwipeReply(10, -2_000, false)).toBe(false);
  });

  test("follows the finger up to the threshold, then resists", () => {
    const below = SWIPE_REPLY_THRESHOLD - 10;
    const beyond = SWIPE_REPLY_THRESHOLD + 40;
    expect(resistedReplySwipeDistance(-20)).toBe(0);
    expect(resistedReplySwipeDistance(below)).toBe(below);
    expect(resistedReplySwipeDistance(beyond)).toBeGreaterThan(SWIPE_REPLY_THRESHOLD);
    expect(resistedReplySwipeDistance(beyond)).toBeLessThan(beyond);
  });
});
